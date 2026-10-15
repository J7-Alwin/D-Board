import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import prisma from '../../prisma.js';
import { projectService } from '../../services/project.service.js';
import { storageService } from '../../storage/storage.service.js';

describe('Fix 4 — Enforce Consistent Project Visibility Across Global Resources', () => {
  const ts = Date.now();

  const userOwner = {
    email: `fix4_owner_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix4 Owner',
    username: `f4_owner_${ts}`,
  };

  const userAdmin = {
    email: `fix4_admin_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix4 Admin',
    username: `f4_admin_${ts}`,
  };

  const userMember = {
    email: `fix4_member_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix4 Member',
    username: `f4_member_${ts}`,
  };

  const userStale = {
    email: `fix4_stale_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix4 Stale Member',
    username: `f4_stale_${ts}`,
  };

  const userOther = {
    email: `fix4_other_${ts}@example.com`,
    password: 'Password123!Secure',
    fullName: 'Fix4 Other Owner',
    username: `f4_other_${ts}`,
  };

  let ownerId: string;
  let adminId: string;
  let memberId: string;
  let staleId: string;
  let otherId: string;

  let ownerCookie: string;
  let adminCookie: string;
  let memberCookie: string;
  let staleCookie: string;
  let otherCookie: string;

  let teamWsId: string;
  let otherWsId: string;
  let deletedWsId: string;

  let openProjId: string;
  let restrictedProjId: string;
  let unassignedProjId: string;
  let staleProjId: string;
  let deletedProjId: string;
  let otherProjId: string;

  let openFileId: string;
  let restrictedFileId: string;
  let unassignedFileId: string;
  let staleFileId: string;
  let deletedFileId: string;

  let openNoteId: string;
  let restrictedNoteId: string;
  let unassignedNoteId: string;
  let staleNoteId: string;

  beforeAll(async () => {
    // 1. Register & login 5 users
    const registerAndLogin = async (userObj: any) => {
      const reg = await request(app).post('/api/auth/register').send(userObj);
      const uid = reg.body.data.user.id;
      await prisma.user.update({ where: { id: uid }, data: { isEmailVerified: true } });
      const login = await request(app).post('/api/auth/login').send({
        identifier: userObj.email,
        password: userObj.password,
      });
      const cookie = (login.headers['set-cookie'] as any)[0].split(';')[0];
      return { id: uid, cookie };
    };

    const o = await registerAndLogin(userOwner);
    ownerId = o.id;
    ownerCookie = o.cookie;

    const a = await registerAndLogin(userAdmin);
    adminId = a.id;
    adminCookie = a.cookie;

    const m = await registerAndLogin(userMember);
    memberId = m.id;
    memberCookie = m.cookie;

    const s = await registerAndLogin(userStale);
    staleId = s.id;
    staleCookie = s.cookie;

    const oth = await registerAndLogin(userOther);
    otherId = oth.id;
    otherCookie = oth.cookie;

    // 2. Create primary team workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Fix4 Team Workspace ${ts}` });
    teamWsId = wsRes.body.data.workspace.id;

    // Add admin and member to team workspace
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: teamWsId, userId: adminId, role: 'WORKSPACE_ADMIN' },
        { workspaceId: teamWsId, userId: memberId, role: 'WORKSPACE_MEMBER' },
      ],
    });

    // 3. Create second team workspace for cross-workspace isolation tests
    const otherWsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', otherCookie)
      .send({ name: `Fix4 Other Workspace ${ts}` });
    otherWsId = otherWsRes.body.data.workspace.id;

    // 4. Create deleted workspace
    const delWsRes = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ name: `Fix4 Deleted Workspace ${ts}` });
    deletedWsId = delWsRes.body.data.workspace.id;
    await prisma.workspace.update({
      where: { id: deletedWsId },
      data: { deletedAt: new Date(), deletionScheduledAt: new Date(Date.now() + 30 * 86400000) },
    });

    // 5. Create projects
    // 5a. Workspace-visible project in teamWsId
    const pOpen = await prisma.project.create({
      data: {
        name: `Fix4 Open Hub ${ts}`,
        key: `F4OP${Math.floor(Math.random() * 1000)}`,
        description: 'Fix4 Open Hub description',
        workspaceId: teamWsId,
        createdById: ownerId,
        visibility: 'WORKSPACE',
        members: {
          create: [{ userId: ownerId, role: 'PROJECT_ADMIN' }],
        },
      },
    });
    openProjId = pOpen.id;

    // 5b. Restricted project in teamWsId explicitly assigning memberId
    const pRestricted = await prisma.project.create({
      data: {
        name: `Fix4 Assigned Restricted ${ts}`,
        key: `F4AR${Math.floor(Math.random() * 1000)}`,
        description: 'Fix4 Assigned Restricted description',
        workspaceId: teamWsId,
        createdById: ownerId,
        visibility: 'RESTRICTED',
        members: {
          create: [
            { userId: ownerId, role: 'PROJECT_ADMIN' },
            { userId: memberId, role: 'PROJECT_MEMBER' },
          ],
        },
      },
    });
    restrictedProjId = pRestricted.id;

    // 5c. Restricted project in teamWsId WITHOUT assigning memberId
    const pUnassigned = await prisma.project.create({
      data: {
        name: `Fix4 Unassigned Restricted ${ts}`,
        key: `F4UR${Math.floor(Math.random() * 1000)}`,
        description: 'Fix4 Unassigned Restricted description',
        workspaceId: teamWsId,
        createdById: ownerId,
        visibility: 'RESTRICTED',
        members: {
          create: [{ userId: ownerId, role: 'PROJECT_ADMIN' }],
        },
      },
    });
    unassignedProjId = pUnassigned.id;

    // 5d. Project with a stale project member (staleId has ProjectMember row but NO WorkspaceMember row in teamWsId)
    const pStale = await prisma.project.create({
      data: {
        name: `Fix4 Stale Project ${ts}`,
        key: `F4ST${Math.floor(Math.random() * 1000)}`,
        description: 'Fix4 Stale Project description',
        workspaceId: teamWsId,
        createdById: ownerId,
        visibility: 'RESTRICTED',
        members: {
          create: [
            { userId: ownerId, role: 'PROJECT_ADMIN' },
            { userId: staleId, role: 'PROJECT_MEMBER' },
          ],
        },
      },
    });
    staleProjId = pStale.id;

    // 5e. Project in deleted workspace
    const pDeleted = await prisma.project.create({
      data: {
        name: `Fix4 Deleted Project ${ts}`,
        key: `F4DL${Math.floor(Math.random() * 1000)}`,
        description: 'Fix4 Deleted Project description',
        workspaceId: deletedWsId,
        createdById: ownerId,
        visibility: 'WORKSPACE',
        members: {
          create: [{ userId: ownerId, role: 'PROJECT_ADMIN' }],
        },
      },
    });
    deletedProjId = pDeleted.id;

    // 5f. Project in other workspace
    const pOther = await prisma.project.create({
      data: {
        name: `Fix4 Other Project ${ts}`,
        key: `F4OT${Math.floor(Math.random() * 1000)}`,
        description: 'Fix4 Other Project description',
        workspaceId: otherWsId,
        createdById: otherId,
        visibility: 'WORKSPACE',
        members: {
          create: [{ userId: otherId, role: 'PROJECT_ADMIN' }],
        },
      },
    });
    otherProjId = pOther.id;

    // 6. Create attachments / files in projects
    const createFile = async (projectId: string, uploaderId: string, name: string) => {
      const att = await prisma.attachment.create({
        data: {
          projectId,
          uploadedById: uploaderId,
          originalName: name,
          storageKey: `test_keys/${name}_${Date.now()}.bin`,
          mimeType: 'text/plain',
          sizeBytes: 1024,
          extension: 'txt',
          category: 'DOCUMENT',
          isPrivate: false,
        },
      });
      return att.id;
    };

    openFileId = await createFile(openProjId, ownerId, 'open_spec.txt');
    restrictedFileId = await createFile(restrictedProjId, ownerId, 'assigned_restricted_doc.txt');
    unassignedFileId = await createFile(unassignedProjId, ownerId, 'secret_unassigned_doc.txt');
    staleFileId = await createFile(staleProjId, ownerId, 'stale_confidential.txt');
    deletedFileId = await createFile(deletedProjId, ownerId, 'deleted_ws_doc.txt');
    await createFile(otherProjId, otherId, 'other_workspace_file.txt');

    // 7. Create notes in projects
    const createNote = async (projectId: string, authorId: string, title: string) => {
      const note = await prisma.note.create({
        data: {
          projectId,
          createdById: authorId,
          title,
          content: `Content for ${title}`,
          visibility: 'TEAM',
        },
      });
      return note.id;
    };

    openNoteId = await createNote(openProjId, ownerId, 'Open Project Team Note');
    restrictedNoteId = await createNote(restrictedProjId, ownerId, 'Assigned Restricted Note');
    unassignedNoteId = await createNote(unassignedProjId, ownerId, 'Secret Unassigned Note');
    staleNoteId = await createNote(staleProjId, ownerId, 'Stale Member Project Note');
    await createNote(deletedProjId, ownerId, 'Deleted Workspace Note');
    await createNote(otherProjId, otherId, 'Other Workspace Note');

    // 8. Create calendar events in projects
    const createEvent = async (projectId: string, authorId: string, title: string) => {
      return await prisma.calendarEvent.create({
        data: {
          projectId,
          createdById: authorId,
          title,
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 90000000),
          type: 'MEETING',
          isPrivate: false,
        },
      });
    };

    await createEvent(openProjId, ownerId, 'Open Project Sync');
    await createEvent(restrictedProjId, ownerId, 'Restricted Assigned Review');
    await createEvent(unassignedProjId, ownerId, 'Secret Board Meeting');
    await createEvent(staleProjId, ownerId, 'Stale Project Planning');
    await createEvent(deletedProjId, ownerId, 'Deleted WS Event');
    await createEvent(otherProjId, otherId, 'Other WS Strategy');

    // 9. Create activities in projects
    await prisma.activity.createMany({
      data: [
        { projectId: openProjId, actorId: ownerId, type: 'FILE_UPLOADED', attachmentId: openFileId, metadata: { filename: 'open_spec.txt' } },
        { projectId: restrictedProjId, actorId: ownerId, type: 'FILE_UPLOADED', attachmentId: restrictedFileId, metadata: { filename: 'assigned_restricted_doc.txt' } },
        { projectId: unassignedProjId, actorId: ownerId, type: 'FILE_UPLOADED', attachmentId: unassignedFileId, metadata: { filename: 'secret_unassigned_doc.txt' } },
        { projectId: staleProjId, actorId: ownerId, type: 'FILE_UPLOADED', attachmentId: staleFileId, metadata: { filename: 'stale_confidential.txt' } },
        { projectId: deletedProjId, actorId: ownerId, type: 'FILE_UPLOADED', attachmentId: deletedFileId, metadata: { filename: 'deleted_ws_doc.txt' } },
        { projectId: otherProjId, actorId: otherId, type: 'FILE_UPLOADED', metadata: { filename: 'other_workspace_file.txt' } },
      ],
    });

    // 10. Create notifications for memberUser
    await prisma.notification.createMany({
      data: [
        { recipientId: memberId, actorId: ownerId, projectId: openProjId, type: 'PROJECT_UPDATED', title: 'Open Project Notification', message: 'Hello Open', link: `/app/projects/${openProjId}` },
        { recipientId: memberId, actorId: ownerId, projectId: restrictedProjId, type: 'PROJECT_UPDATED', title: 'Restricted Project Notification', message: 'Hello Restricted', link: `/app/projects/${restrictedProjId}` },
        { recipientId: memberId, actorId: ownerId, projectId: unassignedProjId, type: 'PROJECT_UPDATED', title: 'Unassigned Project Notification', message: 'Should Not See', link: `/app/projects/${unassignedProjId}` },
        { recipientId: memberId, actorId: ownerId, projectId: deletedProjId, type: 'PROJECT_UPDATED', title: 'Deleted WS Notification', message: 'Should Not See Deleted', link: `/app/projects/${deletedProjId}` },
      ],
    });
  }, 120000);

  afterAll(async () => {
    // Cleanup created test records
    const userIds = [ownerId, adminId, memberId, staleId, otherId].filter(Boolean);
    const projectIds = [openProjId, restrictedProjId, unassignedProjId, staleProjId, deletedProjId, otherProjId].filter(Boolean);
    const wsIds = [teamWsId, otherWsId, deletedWsId].filter(Boolean);

    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.activity.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.calendarEvent.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.attachment.deleteMany({ where: { uploadedById: { in: userIds } } });
    await prisma.note.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.projectMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.workspaceMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
    await prisma.workspace.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }, 120000);

  describe('1. Workspace-Visible Project Access for Workspace Members', () => {
    it('memberUser can view workspace-visible project details without explicit ProjectMember row', async () => {
      const res = await request(app)
        .get(`/api/projects/${openProjId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.project.id).toBe(openProjId);
      expect(res.body.data.project.visibility).toBe('Workspace');
    });

    it('memberUser can view files in workspace-visible project', async () => {
      const res = await request(app)
        .get(`/api/projects/${openProjId}/files`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.files.some((f: any) => f.id === openFileId)).toBe(true);
    });

    it('memberUser sees workspace-visible project files in global files listing', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.files.some((f: any) => f.id === openFileId)).toBe(true);
    });

    it('memberUser can view notes in workspace-visible project', async () => {
      const res = await request(app)
        .get(`/api/projects/${openProjId}/notes`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.notes.some((n: any) => n.id === openNoteId)).toBe(true);
    });

    it('memberUser sees workspace-visible project notes in global notes listing', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.notes.some((n: any) => n.id === openNoteId)).toBe(true);
    });

    it('memberUser sees workspace-visible project events in global calendar listing', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.items.some((item: any) => item.projectId === openProjId)).toBe(true);
    });

    it('memberUser sees workspace-visible project activities in global activity listing', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.activities.some((act: any) => act.projectId === openProjId)).toBe(true);
    });

    it('memberUser finds workspace-visible project resources in global search', async () => {
      const res = await request(app)
        .get('/api/search?q=open')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.projects.some((p: any) => p.id === openProjId)).toBe(true);
      expect(res.body.data.files.some((f: any) => f.id === openFileId)).toBe(true);
      expect(res.body.data.notes.some((n: any) => n.id === openNoteId)).toBe(true);
    });
  });

  describe('2. Restricted-Project Denial for Unassigned Members', () => {
    it('memberUser is denied access (403) to unassigned restricted project', async () => {
      const res = await request(app)
        .get(`/api/projects/${unassignedProjId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
    });

    it('memberUser is denied access (403) to unassigned restricted project files', async () => {
      const res = await request(app)
        .get(`/api/projects/${unassignedProjId}/files`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
    });

    it('memberUser is denied download (403) of files in unassigned restricted project', async () => {
      const res = await request(app)
        .get(`/api/projects/${unassignedProjId}/files/${unassignedFileId}/download`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
    });

    it('memberUser is denied access (403) to unassigned restricted project notes', async () => {
      const res = await request(app)
        .get(`/api/projects/${unassignedProjId}/notes`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
    });

    it('memberUser is denied access (403) to unassigned restricted project calendar', async () => {
      const res = await request(app)
        .get(`/api/projects/${unassignedProjId}/calendar/events`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
    });

    it('memberUser is denied access (403) to unassigned restricted project activities', async () => {
      const res = await request(app)
        .get(`/api/projects/${unassignedProjId}/activity`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
    });

    it('global files listing NEVER leaks files from unassigned restricted projects', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.files.some((f: any) => f.id === unassignedFileId)).toBe(false);
    });

    it('global notes listing NEVER leaks notes from unassigned restricted projects', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.notes.some((n: any) => n.id === unassignedNoteId)).toBe(false);
    });

    it('global calendar listing NEVER leaks events from unassigned restricted projects', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.items.some((item: any) => item.projectId === unassignedProjId)).toBe(false);
    });

    it('global activity listing NEVER leaks activities from unassigned restricted projects', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.activities.some((act: any) => act.projectId === unassignedProjId)).toBe(false);
    });

    it('global search NEVER returns resources from unassigned restricted projects', async () => {
      const res = await request(app)
        .get('/api/search?q=unassigned')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.projects.some((p: any) => p.id === unassignedProjId)).toBe(false);
      expect(res.body.data.files.some((f: any) => f.id === unassignedFileId)).toBe(false);
      expect(res.body.data.notes.some((n: any) => n.id === unassignedNoteId)).toBe(false);
    });

    it('notifications listing NEVER leaks notifications from unassigned restricted projects', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.some((notif: any) => notif.projectId === unassignedProjId)).toBe(false);
    });
  });

  describe('3. Restricted-Project Access for Explicitly Assigned Members', () => {
    it('memberUser can view explicitly assigned restricted project details', async () => {
      const res = await request(app)
        .get(`/api/projects/${restrictedProjId}`)
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.project.id).toBe(restrictedProjId);
      expect(res.body.data.project.visibility).toBe('Restricted');
    });

    it('memberUser sees assigned restricted project files in global files listing', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.files.some((f: any) => f.id === restrictedFileId)).toBe(true);
    });

    it('memberUser sees assigned restricted project notes in global notes listing', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.notes.some((n: any) => n.id === restrictedNoteId)).toBe(true);
    });

    it('memberUser sees assigned restricted project notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Cookie', memberCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.some((notif: any) => notif.projectId === restrictedProjId)).toBe(true);
    });
  });

  describe('4. Workspace Membership Required Before Project Membership Grants Access', () => {
    it('stale project member without workspace membership is denied (403) on project details', async () => {
      const res = await request(app)
        .get(`/api/projects/${staleProjId}`)
        .set('Cookie', staleCookie);

      expect(res.status).toBe(403);
    });

    it('stale project member without workspace membership is denied (403) on project files', async () => {
      const res = await request(app)
        .get(`/api/projects/${staleProjId}/files`)
        .set('Cookie', staleCookie);

      expect(res.status).toBe(403);
    });

    it('stale project member without workspace membership is denied (403) on project file download', async () => {
      const res = await request(app)
        .get(`/api/projects/${staleProjId}/files/${staleFileId}/download`)
        .set('Cookie', staleCookie);

      expect(res.status).toBe(403);
    });

    it('stale project member without workspace membership is denied (403) on project notes', async () => {
      const res = await request(app)
        .get(`/api/projects/${staleProjId}/notes`)
        .set('Cookie', staleCookie);

      expect(res.status).toBe(403);
    });

    it('stale project member without workspace membership is denied (403) on project calendar', async () => {
      const res = await request(app)
        .get(`/api/projects/${staleProjId}/calendar/events`)
        .set('Cookie', staleCookie);

      expect(res.status).toBe(403);
    });

    it('stale project member without workspace membership is denied (403) on project activities', async () => {
      const res = await request(app)
        .get(`/api/projects/${staleProjId}/activity`)
        .set('Cookie', staleCookie);

      expect(res.status).toBe(403);
    });

    it('stale project member without workspace membership never sees project in global listings', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', staleCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.files.some((f: any) => f.id === staleFileId)).toBe(false);
    });
  });

  describe('5. Workspace Owner and Admin Access Policy', () => {
    it('workspace owner can view all projects and resources in the workspace', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.files.some((f: any) => f.id === openFileId)).toBe(true);
      expect(res.body.data.files.some((f: any) => f.id === restrictedFileId)).toBe(true);
      expect(res.body.data.files.some((f: any) => f.id === unassignedFileId)).toBe(true);
    });

    it('workspace admin can view all projects and resources in the workspace', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', adminCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.files.some((f: any) => f.id === openFileId)).toBe(true);
      expect(res.body.data.files.some((f: any) => f.id === restrictedFileId)).toBe(true);
      expect(res.body.data.files.some((f: any) => f.id === unassignedFileId)).toBe(true);
    });
  });

  describe('6. Cross-Workspace Resource Isolation', () => {
    it('user from different workspace cannot see any resources of other workspace', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', otherCookie)
        .set('X-Workspace-Id', otherWsId);

      expect(res.status).toBe(200);
      expect(res.body.data.files.some((f: any) => f.id === openFileId)).toBe(false);
      expect(res.body.data.files.some((f: any) => f.id === restrictedFileId)).toBe(false);
    });

    it('manipulating X-Workspace-Id to unauthorized workspace is rejected with 403', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', otherCookie)
        .set('X-Workspace-Id', teamWsId);

      expect(res.status).toBe(403);
    });
  });

  describe('7. Soft-Deleted Workspace Denial', () => {
    it('accessing project in soft-deleted workspace returns 404', async () => {
      const res = await request(app)
        .get(`/api/projects/${deletedProjId}`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(404);
    });

    it('accessing project files in soft-deleted workspace returns 404', async () => {
      const res = await request(app)
        .get(`/api/projects/${deletedProjId}/files`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(404);
    });

    it('accessing project notes in soft-deleted workspace returns 404', async () => {
      const res = await request(app)
        .get(`/api/projects/${deletedProjId}/notes`)
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(404);
    });

    it('passing X-Workspace-Id of soft-deleted workspace to global files returns 404', async () => {
      const res = await request(app)
        .get('/api/files')
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', deletedWsId);

      expect(res.status).toBe(404);
    });

    it('passing X-Workspace-Id of soft-deleted workspace to global notes returns 404', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', deletedWsId);

      expect(res.status).toBe(404);
    });

    it('passing X-Workspace-Id of soft-deleted workspace to global calendar returns 404', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', deletedWsId);

      expect(res.status).toBe(404);
    });

    it('passing X-Workspace-Id of soft-deleted workspace to global activities returns 404', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', deletedWsId);

      expect(res.status).toBe(404);
    });

    it('passing X-Workspace-Id of soft-deleted workspace to notifications returns 404', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Cookie', ownerCookie)
        .set('X-Workspace-Id', deletedWsId);

      expect(res.status).toBe(404);
    });

    it('notifications from deleted workspace are NOT returned even without X-Workspace-Id header', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Cookie', memberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.some((notif: any) => notif.projectId === deletedProjId)).toBe(false);
    });
  });

  describe('8. Real-time Socket.IO Room Authorization', () => {
    it('permits member to join open project room and assigned restricted project room', async () => {
      await expect(projectService.verifyProjectAccess(openProjId, memberId)).resolves.toBeDefined();
      await expect(projectService.verifyProjectAccess(restrictedProjId, memberId)).resolves.toBeDefined();
    });

    it('rejects member from joining unassigned restricted project room (403)', async () => {
      await expect(projectService.verifyProjectAccess(unassignedProjId, memberId)).rejects.toThrow(/not authorized/i);
    });

    it('rejects stale project member from joining room without workspace membership (403)', async () => {
      await expect(projectService.verifyProjectAccess(staleProjId, staleId)).rejects.toThrow(/not authorized/i);
    });

    it('rejects joining room for project in deleted workspace (404)', async () => {
      await expect(projectService.verifyProjectAccess(deletedProjId, ownerId)).rejects.toThrow(/deleted/i);
    });
  });
});
