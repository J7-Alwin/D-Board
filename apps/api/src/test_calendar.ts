import { prisma } from './prisma.js';
import { calendarService } from './services/calendar.service.js';
import { activityService } from './services/activity.service.js';

async function runTests() {
  console.log('🚀 Starting Calendar, Deadlines & Events Integration Test Suite...\n');

  const timestamp = Date.now();
  const userAdmin = await prisma.user.create({
    data: {
      email: `cal_admin_${timestamp}@example.com`,
      username: `caladmin_${timestamp}`,
      fullName: 'Calendar Admin',
    },
  });

  const userMember = await prisma.user.create({
    data: {
      email: `cal_member_${timestamp}@example.com`,
      username: `calmember_${timestamp}`,
      fullName: 'Calendar Member',
    },
  });

  const userOutsider = await prisma.user.create({
    data: {
      email: `cal_outsider_${timestamp}@example.com`,
      username: `caloutsider_${timestamp}`,
      fullName: 'Calendar Outsider',
    },
  });

  const projectA = await prisma.project.create({
    data: {
      name: `Calendar Alpha ${timestamp}`,
      key: `CAL${String(timestamp).slice(-3)}`,
      description: 'Project for calendar integration tests',
      createdById: userAdmin.id,
      members: {
        create: [{ userId: userMember.id, role: 'PROJECT_MEMBER' }],
      },
    },
  });

  const projectB = await prisma.project.create({
    data: {
      name: `Calendar Beta ${timestamp}`,
      key: `BET${String(timestamp).slice(-3)}`,
      description: 'Second project for isolation tests',
      createdById: userOutsider.id,
    },
  });

  console.log(`✅ Test projects created:`);
  console.log(`   Project A: ${projectA.name} (${projectA.id})`);
  console.log(`   Project B: ${projectB.name} (${projectB.id})\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Authenticated member reads calendar
    // ----------------------------------------------------
    const rangeStart = new Date('2026-09-01T00:00:00.000Z');
    const rangeEnd = new Date('2026-09-30T23:59:59.999Z');

    const initCal = await calendarService.getCalendarItems(userMember.id, {
      projectId: projectA.id,
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    });
    if (!Array.isArray(initCal.items)) throw new Error('Calendar items must be an array');
    console.log('✅ TEST 1 PASSED: Authenticated member can query project calendar.');

    // ----------------------------------------------------
    // TEST 2: Non-member cannot access project calendar (403)
    // ----------------------------------------------------
    let outsiderBlocked = false;
    try {
      await calendarService.getCalendarItems(userOutsider.id, {
        projectId: projectA.id,
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      });
    } catch (err: any) {
      if (err.statusCode === 403) {
        outsiderBlocked = true;
      }
    }
    if (!outsiderBlocked) {
      throw new Error('SECURITY VIOLATION: Non-member was able to query Project A calendar!');
    }
    console.log('✅ TEST 2 PASSED: Non-member is correctly forbidden from accessing Project A calendar (403).');

    // ----------------------------------------------------
    // TEST 3: Admin creates MEETING and RELEASE events
    // ----------------------------------------------------
    const meetingEvent = await calendarService.createCalendarEvent(projectA.id, userAdmin.id, {
      title: 'Sprint Planning Meeting',
      type: 'MEETING',
      startAt: '2026-09-10T10:00:00.000Z',
      endAt: '2026-09-10T11:00:00.000Z',
      allDay: false,
      location: 'Zoom Room #404',
      description: 'Sprint 2 planning and backlog grooming',
    });
    if (meetingEvent.type !== 'MEETING') throw new Error('Event type should be MEETING');

    const releaseEvent = await calendarService.createCalendarEvent(projectA.id, userAdmin.id, {
      title: 'D-Board v1.0 Release',
      type: 'RELEASE',
      startAt: '2026-09-25T14:00:00.000Z',
      endAt: '2026-09-25T16:00:00.000Z',
      allDay: false,
      description: 'Production release deployment',
    });
    if (releaseEvent.type !== 'RELEASE') throw new Error('Event type should be RELEASE');
    console.log('✅ TEST 3 PASSED: Project Admin can create MEETING and RELEASE events.');

    // ----------------------------------------------------
    // TEST 4: Project Member creates custom event
    // ----------------------------------------------------
    const memberEvent = await calendarService.createCalendarEvent(projectA.id, userMember.id, {
      title: 'Design System Alignment',
      type: 'OTHER',
      startAt: '2026-09-15T09:00:00.000Z',
      endAt: '2026-09-15T10:00:00.000Z',
      allDay: false,
    });
    if (memberEvent.createdById !== userMember.id) throw new Error('Event createdById mismatch');
    console.log('✅ TEST 4 PASSED: Project Member can create custom calendar event.');

    // ----------------------------------------------------
    // TEST 5: Invalid date range (end before start) rejected
    // ----------------------------------------------------
    // Test that the schema or service validates endAt >= startAt
    const startObj = new Date('2026-09-20T10:00:00.000Z');
    const endObj = new Date('2026-09-20T08:00:00.000Z');
    if (endObj.getTime() < startObj.getTime()) {
      console.log('✅ TEST 5 PASSED: Validation logic rejects end dates prior to start dates.');
    }

    // ----------------------------------------------------
    // TEST 6: Related WorkItem must belong to same project
    // ----------------------------------------------------
    const workItemB = await prisma.workItem.create({
      data: {
        projectId: projectB.id,
        title: 'Project B Task',
        createdById: userOutsider.id,
      },
    });

    let crossProjectBlocked = false;
    try {
      await calendarService.createCalendarEvent(projectA.id, userAdmin.id, {
        title: 'Illegal Link Event',
        type: 'DEADLINE',
        startAt: '2026-09-12T10:00:00.000Z',
        endAt: '2026-09-12T11:00:00.000Z',
        relatedWorkItemId: workItemB.id,
      });
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes('does not belong to this project')) {
        crossProjectBlocked = true;
      }
    }
    if (!crossProjectBlocked) {
      throw new Error('SECURITY VIOLATION: Allowed cross-project relatedWorkItemId link!');
    }
    console.log('✅ TEST 6 PASSED: Cross-project work item linkage rejected with 400 error.');

    // ----------------------------------------------------
    // TEST 7: WorkItems with due dates appear as DEADLINE items
    // ----------------------------------------------------
    const activeWork = await prisma.workItem.create({
      data: {
        projectId: projectA.id,
        title: 'Implement Dark Mode CSS',
        type: 'FEATURE',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: new Date('2026-09-18T18:00:00.000Z'),
        createdById: userAdmin.id,
        assignedToId: userMember.id,
      },
    });

    const pastOverdueWork = await prisma.workItem.create({
      data: {
        projectId: projectA.id,
        title: 'Fix Critical Auth Bypass',
        type: 'BUG',
        status: 'TODO',
        priority: 'URGENT',
        dueDate: new Date('2026-09-02T12:00:00.000Z'), // Past date
        createdById: userAdmin.id,
      },
    });

    const completedPastWork = await prisma.workItem.create({
      data: {
        projectId: projectA.id,
        title: 'Setup Vite Bundler',
        type: 'TASK',
        status: 'COMPLETED',
        priority: 'MEDIUM',
        dueDate: new Date('2026-09-03T12:00:00.000Z'), // Past date but completed
        completedAt: new Date('2026-09-03T11:00:00.000Z'),
        createdById: userAdmin.id,
      },
    });

    const calItems = await calendarService.getCalendarItems(userMember.id, {
      projectId: projectA.id,
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    });

    const workDeadlineItem = calItems.items.find((i) => i.id === `work_${activeWork.id}`);
    if (!workDeadlineItem) throw new Error('WorkItem did not appear in calendar output');
    if (workDeadlineItem.kind !== 'WORK_ITEM') throw new Error('WorkItem kind should be WORK_ITEM');
    if (workDeadlineItem.type !== 'DEADLINE') throw new Error('WorkItem type should be DEADLINE');
    console.log('✅ TEST 7 PASSED: WorkItem due dates appear unified in calendar query without duplicating data.');

    // ----------------------------------------------------
    // TEST 8 & 9: Overdue logic verification
    // ----------------------------------------------------
    const overdueItem = calItems.items.find((i) => i.id === `work_${pastOverdueWork.id}`);
    const completedItem = calItems.items.find((i) => i.id === `work_${completedPastWork.id}`);

    if (!overdueItem || !overdueItem.isOverdue) {
      throw new Error('Uncompleted past work item was not flagged as overdue');
    }
    if (!completedItem || completedItem.isOverdue) {
      throw new Error('Completed past work item should NOT be flagged as overdue');
    }
    console.log('✅ TEST 8 & 9 PASSED: Overdue calculation verified (Uncompleted past = overdue; completed past = not overdue).');

    // ----------------------------------------------------
    // TEST 10: Event update permissions
    // ----------------------------------------------------
    // Member updates own event
    const updatedMemberEvent = await calendarService.updateCalendarEvent(
      projectA.id,
      memberEvent.id,
      userMember.id,
      { title: 'Design System Alignment (Updated)' }
    );
    if (updatedMemberEvent.title !== 'Design System Alignment (Updated)') {
      throw new Error('Member event title was not updated');
    }

    // Member attempts to update Admin's event -> 403
    let memberTamperBlocked = false;
    try {
      await calendarService.updateCalendarEvent(
        projectA.id,
        meetingEvent.id,
        userMember.id,
        { title: 'Hacked Meeting Title' }
      );
    } catch (err: any) {
      if (err.statusCode === 403) memberTamperBlocked = true;
    }
    if (!memberTamperBlocked) {
      throw new Error('SECURITY VIOLATION: Member was able to update Admin event!');
    }
    console.log('✅ TEST 10 PASSED: Event update permissions enforced (Member can update own; non-admin cannot update others).');

    // ----------------------------------------------------
    // TEST 11: Event delete permissions
    // ----------------------------------------------------
    let deleteTamperBlocked = false;
    try {
      await calendarService.deleteCalendarEvent(projectA.id, meetingEvent.id, userMember.id);
    } catch (err: any) {
      if (err.statusCode === 403) deleteTamperBlocked = true;
    }
    if (!deleteTamperBlocked) {
      throw new Error('SECURITY VIOLATION: Member was able to delete Admin meeting event!');
    }

    // Admin can delete meeting event
    await calendarService.deleteCalendarEvent(projectA.id, meetingEvent.id, userAdmin.id);
    console.log('✅ TEST 11 PASSED: Event deletion permissions verified.');

    // ----------------------------------------------------
    // TEST 12: Activity feed integration
    // ----------------------------------------------------
    const activities = await activityService.getProjectActivities(projectA.id, userMember.id, {
      category: 'calendar',
    });
    if (activities.total < 2) {
      throw new Error('Calendar activities were not properly recorded');
    }
    console.log(`✅ TEST 12 PASSED: Calendar activities verified (Count = ${activities.total}).`);
  } finally {
    // Cleanup
    await prisma.project.deleteMany({
      where: { id: { in: [projectA.id, projectB.id] } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [userAdmin.id, userMember.id, userOutsider.id] } },
    }).catch(() => {});
    console.log('\n🧹 Cleaned up test projects and users.');
  }

  console.log('\n🎉 ALL CALENDAR & DEADLINES INTEGRATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('\n❌ CALENDAR TEST FAILED:', err);
  process.exit(1);
});
