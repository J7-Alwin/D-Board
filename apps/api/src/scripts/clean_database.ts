import 'dotenv/config';
import prisma from '../prisma.js';

async function purgeDatabase() {
  console.log('----------------------------------------------------');
  console.log('PURGING D-BOARD DATABASE (USERS, PROJECTS, ALL DATA)');
  console.log('----------------------------------------------------');

  try {
    // Delete in relational order to respect foreign key constraints
    console.log('1. Deleting Notifications...');
    const notifs = await prisma.notification.deleteMany({});
    console.log(`   Deleted ${notifs.count} notifications.`);

    console.log('2. Deleting Comments...');
    const comments = await prisma.comment.deleteMany({});
    console.log(`   Deleted ${comments.count} comments.`);

    console.log('3. Deleting Note Mentions...');
    const noteMentions = await prisma.noteMention.deleteMany({});
    console.log(`   Deleted ${noteMentions.count} note mentions.`);

    console.log('4. Deleting Notes...');
    const notes = await prisma.note.deleteMany({});
    console.log(`   Deleted ${notes.count} notes.`);

    console.log('5. Deleting Calendar Events...');
    const calEvents = await prisma.calendarEvent.deleteMany({});
    console.log(`   Deleted ${calEvents.count} calendar events.`);

    console.log('6. Deleting Attachments...');
    const attachments = await prisma.attachment.deleteMany({});
    console.log(`   Deleted ${attachments.count} attachments.`);

    console.log('7. Deleting Activities...');
    const activities = await prisma.activity.deleteMany({});
    console.log(`   Deleted ${activities.count} activities.`);

    console.log('8. Deleting Work Items...');
    const workItems = await prisma.workItem.deleteMany({});
    console.log(`   Deleted ${workItems.count} work items.`);

    console.log('9. Deleting Project Invitations...');
    const invitations = await prisma.invitation.deleteMany({});
    console.log(`   Deleted ${invitations.count} invitations.`);

    console.log('10. Deleting Project Members...');
    const members = await prisma.projectMember.deleteMany({});
    console.log(`   Deleted ${members.count} project members.`);

    console.log('11. Deleting Projects...');
    const projects = await prisma.project.deleteMany({});
    console.log(`   Deleted ${projects.count} projects.`);

    console.log('12. Deleting Users...');
    const users = await prisma.user.deleteMany({});
    console.log(`   Deleted ${users.count} users.`);

    console.log('\n====================================================');
    console.log('DATABASE SUCCESSFULLY WIPED CLEAN! Fresh slate ready.');
    console.log('====================================================');
  } catch (err) {
    console.error('Purge Database Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

purgeDatabase();
