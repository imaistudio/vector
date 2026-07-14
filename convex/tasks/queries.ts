import { ConvexError, v } from 'convex/values';
import { query, type QueryCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { requireWork } from '../work/lib';

async function userSummary(ctx: QueryCtx, userId?: Id<'users'>) {
  if (!userId) return null;
  const user = await ctx.db.get('users', userId);
  return user
    ? {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        image: user.image,
      }
    : null;
}

export const listByWork = query({
  args: { workId: v.id('issues') },
  handler: async (ctx, args) => {
    await requireWork(ctx, args.workId, 'view');
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_work_position', q => q.eq('workId', args.workId))
      .collect();
    return await Promise.all(
      tasks.map(async task => ({
        ...task,
        assignee: await userSummary(ctx, task.assigneeId),
      })),
    );
  },
});

export const get = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    const task = await ctx.db.get('tasks', args.taskId);
    if (!task) throw new ConvexError('TASK_NOT_FOUND');
    const work = await requireWork(ctx, task.workId, 'view');
    const [assignee, attention, executions] = await Promise.all([
      userSummary(ctx, task.assigneeId),
      ctx.db
        .query('workAttentionRequests')
        .withIndex('by_task', q => q.eq('taskId', task._id))
        .order('desc')
        .collect(),
      ctx.db
        .query('issueLiveActivities')
        .withIndex('by_task', q => q.eq('taskId', task._id))
        .order('desc')
        .collect(),
    ]);
    return {
      ...task,
      work: { _id: work._id, key: work.key, title: work.title },
      assignee,
      attention,
      executions,
    };
  },
});
