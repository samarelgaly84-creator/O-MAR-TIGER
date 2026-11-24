import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    username: text('username').notNull().unique(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    coverUrl: text('cover_url'),
    bio: text('bio').default(''),
    role: text('role').notNull().default('user'), // 'user' | 'moderator' | 'admin'
    isBanned: boolean('is_banned').notNull().default(false),
    isVerified: boolean('is_verified').notNull().default(false),
    plan: text('plan').notNull().default('free'), // 'free' | 'plus' | 'pro'
    storageQuotaBytes: bigint('storage_quota_bytes', { mode: 'number' }).notNull().default(104857600), // 100 MB Free
    storageUsedBytes: bigint('storage_used_bytes', { mode: 'number' }).notNull().default(0),
    aiCreditsUsed: integer('ai_credits_used').notNull().default(0),
    aiCreditsLimit: integer('ai_credits_limit').notNull().default(10000),
    aiCreditsResetAt: timestamp('ai_credits_reset_at').defaultNow().notNull(),
    aiLastMonthUsed: integer('ai_last_month_used').notNull().default(0),
    aiTotalMessagesAllTime: integer('ai_total_messages_all_time').notNull().default(0),
    aiCelebrationPending: boolean('ai_celebration_pending').notNull().default(false),
    aiLastSettlementAt: timestamp('ai_last_settlement_at'),
    isOnline: boolean('is_online').notNull().default(false),
    lastSeenAt: timestamp('last_seen_at').defaultNow(),
    publicKeyJwk: jsonb('public_key_jwk'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_username_idx').on(table.username),
    index('users_email_idx').on(table.email),
  ]
);

// 2. Profiles
export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  location: text('location').default(''),
  website: text('website').default(''),
  workplace: text('workplace').default(''),
  education: text('education').default(''),
  birthdate: text('birthdate').default(''),
  privacySettings: jsonb('privacy_settings')
    .$type<{
      profileVisibility: 'public' | 'friends' | 'private';
      messagePrivacy: 'everyone' | 'friends';
      storyPrivacy: 'public' | 'friends';
      showOnlineStatus: boolean;
      allowLocationServices?: boolean;
      shareLiveWithFriends?: boolean;
      followPrivacy?: 'everyone' | 'approval';
      commentPrivacy?: 'everyone' | 'friends';
      mentionPrivacy?: 'everyone' | 'friends';
    }>()
    .default({
      profileVisibility: 'public',
      messagePrivacy: 'everyone',
      storyPrivacy: 'public',
      showOnlineStatus: true,
      allowLocationServices: false,
      shareLiveWithFriends: false,
      followPrivacy: 'everyone',
      commentPrivacy: 'everyone',
      mentionPrivacy: 'everyone',
    })
    .notNull(),
  notificationSettings: jsonb('notification_settings')
    .$type<{
      messages: boolean;
      friends: boolean;
      reactions: boolean;
      comments: boolean;
      live: boolean;
      quietMode?: boolean;
    }>()
    .default({
      messages: true,
      friends: true,
      reactions: true,
      comments: true,
      live: true,
      quietMode: false,
    })
    .notNull(),
  soundSettings: jsonb('sound_settings')
    .$type<{
      callRingtone: string;
      messageTone: string;
      notificationTone: string;
      vibrationEnabled: boolean;
      silentMode: boolean;
      callSoundEnabled: boolean;
      messageSoundEnabled: boolean;
      notificationSoundEnabled: boolean;
    }>()
    .default({
      callRingtone: 'tiger_classic',
      messageTone: 'crystal_drop',
      notificationTone: 'gentle_bell',
      vibrationEnabled: true,
      silentMode: false,
      callSoundEnabled: true,
      messageSoundEnabled: true,
      notificationSoundEnabled: true,
    })
    .notNull(),
  interests: jsonb('interests').$type<string[]>().default([]).notNull(),
  skills: jsonb('skills').$type<string[]>().default([]).notNull(),
  widgetsConfig: jsonb('widgets_config')
    .$type<{ enabled: string[]; customQuote?: string; goals?: string[] }>()
    .default({
      enabled: ['clock', 'xp', 'achievements', 'interests', 'activity'],
      customQuote: '',
      goals: [],
    })
    .notNull(),
  themeConfig: jsonb('theme_config')
    .$type<{
      mode: 'dark' | 'light';
      accent: 'orange' | 'blue' | 'purple' | 'green' | 'custom';
      customHex?: string;
      fontSize: 'sm' | 'md' | 'lg';
      cardStyle: 'flat' | 'elevated';
      reducedMotion: boolean;
    }>()
    .default({
      mode: 'dark',
      accent: 'orange',
      fontSize: 'md',
      cardStyle: 'flat',
      reducedMotion: false,
    })
    .notNull(),
  xp: integer('xp').notNull().default(0),
  level: text('level').notNull().default('Rookie'),
  coins: integer('coins').notNull().default(100),
  streakDays: integer('streak_days').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastActivityDate: text('last_activity_date').default(''),
  activeFrame: text('active_frame').default(''),
  featuredPostId: integer('featured_post_id'),
  avatarConfig: jsonb('avatar_config').$type<Record<string, unknown>>(),
  language: text('language').notNull().default('ar'),
  theme: text('theme').notNull().default('dark'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Friends
export const friends = pgTable(
  'friends',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    friendId: integer('friend_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('friends_pair_idx').on(table.userId, table.friendId)]
);

// 4. Friend Requests
export const friendRequests = pgTable(
  'friend_requests',
  {
    id: serial('id').primaryKey(),
    senderId: integer('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    receiverId: integer('receiver_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('friend_requests_receiver_idx').on(table.receiverId, table.status)]
);

// 5. Followers
export const followers = pgTable(
  'followers',
  {
    id: serial('id').primaryKey(),
    followerId: integer('follower_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    followingId: integer('following_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('followers_pair_idx').on(table.followerId, table.followingId)]
);

// Blocked Users
export const blockedUsers = pgTable(
  'blocked_users',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    blockedUserId: integer('blocked_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('blocked_pair_idx').on(table.userId, table.blockedUserId)]
);

// Muted Users
export const mutedUsers = pgTable(
  'muted_users',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mutedUserId: integer('muted_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('muted_pair_idx').on(table.userId, table.mutedUserId)]
);

// 6. Groups
export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description').default(''),
  avatarUrl: text('avatar_url'),
  coverUrl: text('cover_url'),
  privacy: text('privacy').notNull().default('public'), // 'public' | 'private'
  category: text('category').notNull().default('general'),
  rules: text('rules').default(''),
  joinPolicy: text('join_policy').notNull().default('open'), // 'open' | 'approval'
  welcomeMessage: text('welcome_message').default(''),
  slowModeSeconds: integer('slow_mode_seconds').notNull().default(0),
  blockedKeywords: jsonb('blocked_keywords').$type<string[]>().default([]).notNull(),
  settingsJson: jsonb('settings_json')
    .$type<{
      postApproval?: boolean;
      commentApproval?: boolean;
      allowImages?: boolean;
      allowVideos?: boolean;
      allowFiles?: boolean;
      allowLinks?: boolean;
      spamProtection?: boolean;
      restrictedPosting?: boolean;
    }>()
    .default({
      postApproval: false,
      commentApproval: false,
      allowImages: true,
      allowVideos: true,
      allowFiles: true,
      allowLinks: true,
      spamProtection: true,
      restrictedPosting: false,
    })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Group Members
export const groupMembers = pgTable(
  'group_members',
  {
    id: serial('id').primaryKey(),
    groupId: integer('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull().default('member'), // 'owner' | 'admin' | 'moderator' | 'member'
    status: text('status').notNull().default('active'), // 'active' | 'pending'
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('group_member_idx').on(table.groupId, table.userId)]
);

// 8. Pages
export const pages = pgTable('pages', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  category: text('category').notNull().default('Creator'),
  description: text('description').default(''),
  avatarUrl: text('avatar_url'),
  coverUrl: text('cover_url'),
  isBusiness: boolean('is_business').notNull().default(false),
  followersCount: integer('followers_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Page Followers
export const pageFollowers = pgTable(
  'page_followers',
  {
    id: serial('id').primaryKey(),
    pageId: integer('page_id')
      .references(() => pages.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull().default('follower'), // 'follower' | 'admin' | 'editor'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('page_follower_idx').on(table.pageId, table.userId)]
);

// 10. Posts
export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    authorId: integer('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    pageId: integer('page_id').references(() => pages.id, { onDelete: 'cascade' }),
    groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    content: text('content').default(''),
    postType: text('post_type').notNull().default('text'), // 'text' | 'image' | 'carousel' | 'video' | 'link' | 'pdf' | 'poll' | 'colored' | 'question' | 'educational' | 'announcement' | 'repost'
    backgroundStyle: text('background_style'),
    linkUrl: text('link_url'),
    linkTitle: text('link_title'),
    location: text('location'),
    locationData: jsonb('location_data').$type<{ lat: number; lng: number; label: string } | null>(),
    hashtags: jsonb('hashtags').$type<string[]>().default([]).notNull(),
    mentions: jsonb('mentions').$type<string[]>().default([]).notNull(),
    pollOptions: jsonb('poll_options').$type<Array<{ id: string; text: string; voterIds: number[] }>>(),
    category: text('category').notNull().default('general'),
    privacy: text('privacy').notNull().default('public'), // 'public' | 'friends' | 'private'
    audience: text('audience').notNull().default('everyone'),
    repostOfId: integer('repost_of_id'),
    isPinned: boolean('is_pinned').notNull().default(false),
    commentsDisabled: boolean('comments_disabled').notNull().default(false),
    isDraft: boolean('is_draft').notNull().default(false),
    isApproved: boolean('is_approved').notNull().default(true),
    scheduledAt: timestamp('scheduled_at'),
    viewsCount: integer('views_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('posts_author_idx').on(table.authorId),
    index('posts_created_idx').on(table.createdAt),
  ]
);

// 11. Post Media
export const postMedia = pgTable('post_media', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id, { onDelete: 'cascade' })
    .notNull(),
  mediaType: text('media_type').notNull(), // 'image' | 'video' | 'pdf' | 'file'
  url: text('url').notNull(),
  fileName: text('file_name'),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  sortOrder: integer('sort_order').notNull().default(0),
});

// 12. Comments
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: integer('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  parentId: integer('parent_id'),
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Comment Reactions
export const commentReactions = pgTable(
  'comment_reactions',
  {
    id: serial('id').primaryKey(),
    commentId: integer('comment_id')
      .references(() => comments.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reactionType: text('reaction_type').notNull().default('like'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('comment_reaction_idx').on(table.commentId, table.userId)]
);

// 14. Post Reactions
export const postReactions = pgTable(
  'post_reactions',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reactionType: text('reaction_type').notNull(), // 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('post_reaction_idx').on(table.postId, table.userId)]
);

// 15. Shares
export const shares = pgTable('shares', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  comment: text('comment').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. Saved Posts
export const savedPosts = pgTable(
  'saved_posts',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('saved_post_idx').on(table.postId, table.userId)]
);

// 17. Stories
export const stories = pgTable('stories', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  mediaUrl: text('media_url'),
  mediaType: text('media_type').notNull().default('image'), // 'image' | 'video' | 'text'
  textOverlay: text('text_overlay').default(''),
  backgroundColor: text('background_color').default('#18181b'),
  stickers: jsonb('stickers').$type<Array<{ id: string; label: string; x: number; y: number }>>().default([]),
  musicTitle: text('music_title'),
  category: text('category').notNull().default('general'),
  privacy: text('privacy').notNull().default('public'),
  isHighlighted: boolean('is_highlighted').notNull().default(false),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Story Views
export const storyViews = pgTable(
  'story_views',
  {
    id: serial('id').primaryKey(),
    storyId: integer('story_id')
      .references(() => stories.id, { onDelete: 'cascade' })
      .notNull(),
    viewerId: integer('viewer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    replyText: text('reply_text'),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('story_view_idx').on(table.storyId, table.viewerId)]
);

// 19. Reels
export const reels = pgTable('reels', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  caption: text('caption').default(''),
  hashtags: jsonb('hashtags').$type<string[]>().default([]).notNull(),
  musicTitle: text('music_title').default('Original Audio'),
  category: text('category').notNull().default('general'),
  viewsCount: integer('views_count').notNull().default(0),
  likesCount: integer('likes_count').notNull().default(0),
  commentsCount: integer('comments_count').notNull().default(0),
  sharesCount: integer('shares_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20. Reel Views / Interactions
export const reelViews = pgTable(
  'reel_views',
  {
    id: serial('id').primaryKey(),
    reelId: integer('reel_id')
      .references(() => reels.id, { onDelete: 'cascade' })
      .notNull(),
    viewerId: integer('viewer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    liked: boolean('liked').notNull().default(false),
    saved: boolean('saved').notNull().default(false),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('reel_view_idx').on(table.reelId, table.viewerId)]
);

// Reel Comments
export const reelComments = pgTable('reel_comments', {
  id: serial('id').primaryKey(),
  reelId: integer('reel_id')
    .references(() => reels.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: integer('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. Chats
export const chats = pgTable('chats', {
  id: serial('id').primaryKey(),
  chatType: text('chat_type').notNull().default('direct'), // 'direct' | 'group'
  name: text('name'),
  avatarUrl: text('avatar_url'),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'set null' }),
  createdBy: integer('created_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 22. Chat Members
export const chatMembers = pgTable(
  'chat_members',
  {
    id: serial('id').primaryKey(),
    chatId: integer('chat_id')
      .references(() => chats.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull().default('member'), // 'admin' | 'member'
    isPinned: boolean('is_pinned').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),
    isMuted: boolean('is_muted').notNull().default(false),
    lastReadAt: timestamp('last_read_at').defaultNow(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('chat_member_idx').on(table.chatId, table.userId)]
);

// 23. Messages
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    chatId: integer('chat_id')
      .references(() => chats.id, { onDelete: 'cascade' })
      .notNull(),
    senderId: integer('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    replyToId: integer('reply_to_id'),
    forwardedFromId: integer('forwarded_from_id'),
    content: text('content').default(''),
    messageType: text('message_type').notNull().default('text'), // 'text' | 'image' | 'video' | 'document' | 'audio' | 'location' | 'encrypted'
    encryptedPayload: jsonb('encrypted_payload').$type<{
      ciphertext: string;
      iv: string;
      senderKeyFingerprint: string;
      algorithm: string;
    }>(),
    locationData: jsonb('location_data').$type<{
      lat: number;
      lng: number;
      label: string;
      liveShareId?: number;
      isLive?: boolean;
      expiresAt?: string;
      durationMinutes?: number;
      stopped?: boolean;
    }>(),
    reactions: jsonb('reactions').$type<Record<string, number[]>>().default({}).notNull(),
    isEdited: boolean('is_edited').notNull().default(false),
    isDeleted: boolean('is_deleted').notNull().default(false),
    readBy: jsonb('read_by').$type<number[]>().default([]).notNull(),
    deliveredTo: jsonb('delivered_to').$type<number[]>().default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('messages_chat_idx').on(table.chatId, table.createdAt)]
);

// 24. Message Attachments
export const messageAttachments = pgTable('message_attachments', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id')
    .references(() => messages.id, { onDelete: 'cascade' })
    .notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  url: text('url').notNull(),
});

// 25. Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    entityType: text('entity_type'),
    entityId: integer('entity_id'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId, table.isRead)]
);

// 26. Cloud Folders
export const cloudFolders = pgTable('cloud_folders', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  parentId: integer('parent_id'),
  name: text('name').notNull(),
  isTrashed: boolean('is_trashed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 27. Cloud Files
export const cloudFiles = pgTable(
  'cloud_files',
  {
    id: serial('id').primaryKey(),
    ownerId: integer('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    folderId: integer('folder_id').references(() => cloudFolders.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    storagePath: text('storage_path').notNull(),
    publicUrl: text('public_url').notNull(),
    extractedText: text('extracted_text').default(''),
    isTrashed: boolean('is_trashed').notNull().default(false),
    trashedAt: timestamp('trashed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('cloud_files_owner_idx').on(table.ownerId, table.isTrashed)]
);

// 28. File Shares
export const fileShares = pgTable('file_shares', {
  id: serial('id').primaryKey(),
  fileId: integer('file_id').references(() => cloudFiles.id, { onDelete: 'cascade' }),
  folderId: integer('folder_id').references(() => cloudFolders.id, { onDelete: 'cascade' }),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  sharedWithUserId: integer('shared_with_user_id').references(() => users.id, { onDelete: 'cascade' }),
  shareToken: text('share_token').notNull().unique(),
  permission: text('permission').notNull().default('view'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 29. AI Conversations
export const aiConversations = pgTable('ai_conversations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull().default('محادثة جديدة'),
  mode: text('mode').notNull().default('assistant'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 30. AI Messages
export const aiMessages = pgTable('ai_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .references(() => aiConversations.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  attachments: jsonb('attachments')
    .$type<Array<{ url: string; fileName: string; mimeType: string; fileSize?: number }>>()
    .default([])
    .notNull(),
  referencedFileIds: jsonb('referenced_file_ids').$type<number[]>().default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 31. Subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('active'),
  amountUsd: integer('amount_usd').notNull().default(0),
  billingCycle: text('billing_cycle').notNull().default('monthly'),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 32. Payments
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  amountUsd: integer('amount_usd').notNull(),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull().default('pending'),
  provider: text('provider').notNull().default('stripe'),
  transactionRef: text('transaction_ref').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 33. Live Streams
export const liveStreams = pgTable('live_streams', {
  id: serial('id').primaryKey(),
  hostId: integer('host_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  status: text('status').notNull().default('live'),
  roomType: text('room_type').notNull().default('video'), // 'video' | 'audio'
  topic: text('topic').default('general'),
  privacy: text('privacy').notNull().default('public'),
  viewersCount: integer('viewers_count').notNull().default(0),
  recordingUrl: text('recording_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
});

// 34. Reports
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id').notNull(),
  groupId: integer('group_id'),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('open'),
  autoFlagged: boolean('auto_flagged').notNull().default(false),
  actionTaken: text('action_taken').default(''),
  resolvedBy: integer('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 35. Admin Logs
export const adminLogs = pgTable('admin_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id'),
  details: jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
  ipAddress: text('ip_address').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 36. User Sessions
export const userSessions = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  deviceInfo: text('device_info').notNull(),
  ipAddress: text('ip_address').default(''),
  isRevoked: boolean('is_revoked').notNull().default(false),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 37. Ephemeral Live Location Shares
export const liveLocationShares = pgTable(
  'live_location_shares',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    chatId: integer('chat_id').references(() => chats.id, { onDelete: 'cascade' }),
    shareScope: text('share_scope').notNull().default('chat'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    accuracy: doublePrecision('accuracy'),
    label: text('label').default(''),
    durationMinutes: integer('duration_minutes').notNull().default(15),
    expiresAt: timestamp('expires_at').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    stoppedAt: timestamp('stopped_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('live_loc_user_active_idx').on(table.userId, table.isActive),
    index('live_loc_chat_active_idx').on(table.chatId, table.isActive),
  ]
);

// 38. Saved & Shared Map Places
export const savedPlaces = pgTable(
  'saved_places',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description').default(''),
    category: text('category').notNull().default('place'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    address: text('address').default(''),
    visibility: text('visibility').notNull().default('private'),
    sharedWithUserIds: jsonb('shared_with_user_ids').$type<number[]>().default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('saved_places_user_idx').on(table.userId)]
);

// 39. Web Push Subscriptions
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('push_subscriptions_user_idx').on(table.userId)]
);

// 40. App Push Config
export const appPushConfig = pgTable('app_push_config', {
  id: integer('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  subject: text('subject').notNull().default('mailto:support@tiger-platform.app'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// =====================================================================
// TIGER CONNECT ECOSYSTEM TABLES (41+)
// =====================================================================

// 41. Group Warnings
export const groupWarnings = pgTable('group_warnings', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  issuedBy: integer('issued_by').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 42. Group Bans & Mutes
export const groupBans = pgTable('group_bans', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  bannedBy: integer('banned_by').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  banType: text('ban_type').notNull().default('temp_ban'), // 'mute' | 'temp_ban' | 'perm_ban'
  reason: text('reason').default(''),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 43. Group Announcements
export const groupAnnouncements = pgTable('group_announcements', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  isPinned: boolean('is_pinned').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 44. Group Files
export const groupFiles = pgTable('group_files', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  uploaderId: integer('uploader_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  fileName: text('file_name').notNull(),
  url: text('url').notNull(),
  mimeType: text('mime_type').default('application/octet-stream'),
  fileSize: integer('file_size').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 45. Group Admin Activity Log
export const groupActivityLogs = pgTable('group_activity_logs', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  adminId: integer('admin_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: text('action').notNull(),
  targetUserId: integer('target_user_id'),
  details: text('details').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 46. Smart Feed Preferences
export const feedPreferences = pgTable('feed_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  hiddenPostIds: jsonb('hidden_post_ids').$type<number[]>().default([]).notNull(),
  hiddenTopics: jsonb('hidden_topics').$type<string[]>().default([]).notNull(),
  mutedHashtags: jsonb('muted_hashtags').$type<string[]>().default([]).notNull(),
  preferredTopics: jsonb('preferred_topics').$type<string[]>().default([]).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 47. Search History
export const searchHistory = pgTable('search_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  query: text('query').notNull(),
  category: text('category').notNull().default('all'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 48. XP Logs (with daily cap checks)
export const xpLogs = pgTable(
  'xp_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    actionType: text('action_type').notNull(),
    xpDelta: integer('xp_delta').notNull(),
    coinsDelta: integer('coins_delta').notNull().default(0),
    dayKey: text('day_key').notNull(),
    note: text('note').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('xp_logs_user_day_idx').on(table.userId, table.dayKey)]
);

// 49. User Achievements
export const userAchievements = pgTable(
  'user_achievements',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    description: text('description').default(''),
    unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_achievement_code_idx').on(table.userId, table.code)]
);

// 50. Tiger Arena Challenges
export const challenges = pgTable('challenges', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  challengeType: text('challenge_type').notNull().default('creativity'),
  frequency: text('frequency').notNull().default('weekly'), // 'daily' | 'weekly'
  xpReward: integer('xp_reward').notNull().default(50),
  coinsReward: integer('coins_reward').notNull().default(25),
  endsAt: timestamp('ends_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 51. Challenge Submissions
export const challengeSubmissions = pgTable('challenge_submissions', {
  id: serial('id').primaryKey(),
  challengeId: integer('challenge_id').references(() => challenges.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  mediaUrl: text('media_url'),
  votesCount: integer('votes_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 52. Challenge Votes
export const challengeVotes = pgTable(
  'challenge_votes',
  {
    id: serial('id').primaryKey(),
    submissionId: integer('submission_id').references(() => challengeSubmissions.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('challenge_vote_pair_idx').on(table.submissionId, table.userId)]
);

// 53. Tiger Games Scores
export const gameScores = pgTable(
  'game_scores',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    gameKey: text('game_key').notNull(), // 'trivia' | 'memory' | 'word' | 'reaction' | 'number'
    score: integer('score').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('game_scores_key_idx').on(table.gameKey, table.score)]
);

// 54. Tiger Learning Lessons
export const learningLessons = pgTable('learning_lessons', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  category: text('category').notNull().default('programming'),
  title: text('title').notNull(),
  summary: text('summary').default(''),
  content: text('content').notNull(),
  quizQuestions: jsonb('quiz_questions')
    .$type<Array<{ question: string; options: string[]; correctIndex: number }>>()
    .default([])
    .notNull(),
  difficulty: text('difficulty').notNull().default('beginner'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 55. Learning Progress & Notes
export const learningProgress = pgTable(
  'learning_progress',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    lessonId: integer('lesson_id').references(() => learningLessons.id, { onDelete: 'cascade' }).notNull(),
    completed: boolean('completed').notNull().default(false),
    quizScore: integer('quiz_score').default(0),
    notes: text('notes').default(''),
    bookmarked: boolean('bookmarked').notNull().default(false),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('learning_user_lesson_idx').on(table.userId, table.lessonId)]
);

// 56. Saved AI Responses
export const aiSavedResponses = pgTable('ai_saved_responses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull().default('general'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 57. Tiger Store — Stores
export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description').default(''),
  avatarUrl: text('avatar_url'),
  coverUrl: text('cover_url'),
  category: text('category').notNull().default('tech'),
  bankName: text('bank_name').default('').notNull(),
  accountHolderName: text('account_holder_name').default('').notNull(),
  iban: text('iban').default('').notNull(),
  accountNumber: text('account_number').default('').notNull(),
  bankNotes: text('bank_notes').default('').notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  followersCount: integer('followers_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 58. Store Followers
export const storeFollowers = pgTable(
  'store_followers',
  {
    id: serial('id').primaryKey(),
    storeId: integer('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('store_follower_pair_idx').on(table.storeId, table.userId)]
);

// 59. Store Products
export const storeProducts = pgTable('store_products', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  sellerId: integer('seller_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  category: text('category').notNull().default('tech'),
  priceUsd: doublePrecision('price_usd').notNull(),
  deliveryFeeUsd: doublePrecision('delivery_fee_usd').notNull().default(0),
  allowCod: boolean('allow_cod').notNull().default(true),
  allowBankTransfer: boolean('allow_bank_transfer').notNull().default(true),
  discountPercent: integer('discount_percent').notNull().default(0),
  stock: integer('stock').notNull().default(10),
  images: jsonb('images').$type<string[]>().default([]).notNull(),
  isFeatured: boolean('is_featured').notNull().default(false),
  ratingAvg: doublePrecision('rating_avg').notNull().default(0),
  reviewsCount: integer('reviews_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 60. Store Favorites
export const storeFavorites = pgTable(
  'store_favorites',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    productId: integer('product_id').references(() => storeProducts.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('store_fav_pair_idx').on(table.userId, table.productId)]
);

// 61. Store Cart Items
export const storeCartItems = pgTable(
  'store_cart_items',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    productId: integer('product_id').references(() => storeProducts.id, { onDelete: 'cascade' }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('store_cart_pair_idx').on(table.userId, table.productId)]
);

// 62. Store Orders
export const storeOrders = pgTable('store_orders', {
  id: serial('id').primaryKey(),
  buyerId: integer('buyer_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  items: jsonb('items').$type<Array<{ productId: number; title: string; priceUsd: number; deliveryFeeUsd?: number; quantity: number }>>().notNull(),
  subtotalUsd: doublePrecision('subtotal_usd').notNull().default(0),
  deliveryFeeUsd: doublePrecision('delivery_fee_usd').notNull().default(0),
  totalUsd: doublePrecision('total_usd').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  shippingAddress: text('shipping_address').notNull(),
  paymentMethod: text('payment_method').notNull().default('cod'), // 'cod' | 'bank_transfer'
  paymentStatus: text('payment_status').notNull().default('cod_pending'), // 'cod_pending' | 'awaiting_transfer' | 'receipt_uploaded' | 'paid' | 'refund_required' | 'refunded'
  selectedBankApp: text('selected_bank_app').default('').notNull(),
  transferReference: text('transfer_reference').default('').notNull(),
  transferredAmountUsd: doublePrecision('transferred_amount_usd').notNull().default(0),
  transferReceiptUrl: text('transfer_receipt_url').default('').notNull(),
  refundAmountUsd: doublePrecision('refund_amount_usd').notNull().default(0),
  refundReceiptUrl: text('refund_receipt_url').default('').notNull(),
  refundNote: text('refund_note').default('').notNull(),
  note: text('note').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 63. Store Reviews
export const storeReviews = pgTable('store_reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => storeProducts.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 64. Coin Transactions
export const coinTransactions = pgTable('coin_transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer('amount').notNull(),
  txType: text('tx_type').notNull(), // 'earn' | 'redeem'
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 65. Reward Catalog Items (cosmetic only)
export const rewardCatalogItems = pgTable('reward_catalog_items', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').default(''),
  itemType: text('item_type').notNull(), // 'frame' | 'badge' | 'theme' | 'decoration'
  costCoins: integer('cost_coins').notNull(),
  previewStyle: text('preview_style').default(''),
  isActive: boolean('is_active').notNull().default(true),
});

// 66. User Unlocked Rewards
export const userUnlockedRewards = pgTable(
  'user_unlocked_rewards',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    rewardId: integer('reward_id').references(() => rewardCatalogItems.id, { onDelete: 'cascade' }).notNull(),
    unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_reward_pair_idx').on(table.userId, table.rewardId)]
);

// 67. Tiger Vault Folders
export const vaultFolders = pgTable('vault_folders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 68. Tiger Vault Items (Private by default)
export const vaultItems = pgTable('vault_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  folderId: integer('folder_id').references(() => vaultFolders.id, { onDelete: 'set null' }),
  itemType: text('item_type').notNull(), // 'post' | 'video' | 'product' | 'image' | 'file' | 'link' | 'news'
  title: text('title').notNull(),
  url: text('url').default(''),
  summary: text('summary').default(''),
  entityId: integer('entity_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 69. Live Room Participants (Host, Co-Host, Moderators, Speakers, Listeners)
export const liveRoomParticipants = pgTable(
  'live_room_participants',
  {
    id: serial('id').primaryKey(),
    streamId: integer('stream_id').references(() => liveStreams.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    role: text('role').notNull().default('listener'), // 'host' | 'co_host' | 'moderator' | 'speaker' | 'listener'
    isMuted: boolean('is_muted').notNull().default(false),
    handRaised: boolean('hand_raised').notNull().default(false),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('live_participant_pair_idx').on(table.streamId, table.userId)]
);

// 70. Tiger Events
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  groupId: integer('group_id').references(() => groups.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').default(''),
  coverUrl: text('cover_url'),
  eventDate: timestamp('event_date').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  mode: text('mode').notNull().default('online'), // 'online' | 'physical'
  locationText: text('location_text').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 71. Event Attendees
export const eventAttendees = pgTable(
  'event_attendees',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    status: text('status').notNull().default('going'), // 'going' | 'interested'
    reminderSet: boolean('reminder_set').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('event_attendee_pair_idx').on(table.eventId, table.userId)]
);

// 72. Event Discussions
export const eventComments = pgTable('event_comments', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 73. Tiger Collab Projects
export const collabProjects = pgTable('collab_projects', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  neededRoles: jsonb('needed_roles').$type<string[]>().default([]).notNull(),
  skills: jsonb('skills').$type<string[]>().default([]).notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'completed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 74. Collab Applications
export const collabApplications = pgTable('collab_applications', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => collabProjects.id, { onDelete: 'cascade' }).notNull(),
  applicantId: integer('applicant_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleRequested: text('role_requested').notNull(),
  message: text('message').default(''),
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 75. Verification Requests
export const verificationRequests = pgTable('verification_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  verificationType: text('verification_type').notNull(), // 'official' | 'creator' | 'organization' | 'community' | 'store'
  details: text('details').notNull(),
  portfolioUrl: text('portfolio_url').default(''),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'revoked'
  reviewedBy: integer('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewNote: text('review_note').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 76. User Appeals
export const userAppeals = pgTable('user_appeals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'approved' | 'rejected'
  reviewedBy: integer('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  resolutionNote: text('resolution_note').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 77. Support Tickets
export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  category: text('category').notNull().default('general'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'resolved'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 78. Ticket Replies
export const ticketReplies = pgTable('ticket_replies', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => supportTickets.id, { onDelete: 'cascade' }).notNull(),
  senderId: integer('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  isStaff: boolean('is_staff').notNull().default(false),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 79. Platform Settings & Feature Flags
export const platformSettings = pgTable('platform_settings', {
  id: integer('id').primaryKey(),
  featureFlags: jsonb('feature_flags')
    .$type<Record<string, boolean>>()
    .default({
      universe: true,
      social: true,
      stories: true,
      reels: true,
      messenger: true,
      communities: true,
      discover: true,
      studio: true,
      ai: true,
      store: true,
      games: true,
      learning: true,
      newsroom: true,
      live: true,
      events: true,
      arena: true,
      collab: true,
      vault: true,
      globe: true,
      coins: true,
    })
    .notNull(),
  maintenanceMode: boolean('maintenance_mode').notNull().default(false),
  announcementText: text('announcement_text').default(''),
  maxUploadMb: integer('max_upload_mb').notNull().default(50),
  updatedBy: integer('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 80. Email & Password Credentials (isolated from users table)
export const userCredentials = pgTable('user_credentials', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 81. Email Auth Session Tokens (SHA-256 hashed bearer tokens)
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('auth_tokens_user_idx').on(table.userId)]
);

// 82. Call Logs (Incoming, Outgoing, Missed, Duration)
export const callLogs = pgTable(
  'call_logs',
  {
    id: serial('id').primaryKey(),
    callId: text('call_id').notNull().unique(),
    callerId: integer('caller_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    calleeId: integer('callee_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    callType: text('call_type').notNull().default('audio'), // 'audio' | 'video'
    status: text('status').notNull().default('ringing'), // 'ringing' | 'answered' | 'declined' | 'missed' | 'ended'
    startedAt: timestamp('started_at').defaultNow().notNull(),
    answeredAt: timestamp('answered_at'),
    endedAt: timestamp('ended_at'),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('call_logs_caller_idx').on(table.callerId),
    index('call_logs_callee_idx').on(table.calleeId),
  ]
);

// 83. Firebase Cloud Messaging (FCM) Device Tokens
export const fcmTokens = pgTable(
  'fcm_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    token: text('token').notNull().unique(),
    platform: text('platform').notNull().default('android'), // 'android' | 'web'
    deviceName: text('device_name').default(''),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('fcm_tokens_user_idx').on(table.userId)]
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  posts: many(posts),
  stories: many(stories),
  reels: many(reels),
  cloudFiles: many(cloudFiles),
  notifications: many(notifications),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  media: many(postMedia),
  comments: many(comments),
  reactions: many(postReactions),
}));

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
  messages: many(messages),
}));
