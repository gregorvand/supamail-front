# Alias Labels Feature - Migration Guide

## Overview
This update adds the ability to label aliases and groups messages by alias in the messages view.

## 1. Database Migration

Run the following SQL in your Supabase SQL Editor:

```sql
-- Add label column to aliases table
ALTER TABLE aliases ADD COLUMN IF NOT EXISTS label TEXT;

-- Optional: Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_aliases_user_id ON aliases(user_id);
```

### Row Level Security (RLS) Policies

**IMPORTANT**: Make sure your `aliases` table has proper RLS policies that allow updates. If you're getting a 204 response but the label isn't updating, you need to add/check your UPDATE policy:

```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'aliases';

-- Example UPDATE policy (adjust based on your auth setup)
CREATE POLICY "Users can update their own aliases"
ON aliases
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- If the policy already exists and needs updating, drop it first:
-- DROP POLICY "Users can update their own aliases" ON aliases;
```

## 2. Changes Made

### Messages Page (`src/routes/messages/+page.svelte`)
- **Grouping by Alias**: Messages are now grouped by their destination alias
- **Label Display**: Each group shows the alias label (or "Unlabeled" if not set)
- **Inline Label Editing**: Click "Add Label" or "Edit Label" to modify labels directly in the messages view
- **Message Count**: Shows the number of messages for each alias
- **Sorting**: Groups are sorted by the most recent message

### Aliases Page (`src/routes/aliases/+page.svelte`)
- **Label Column**: Added label field to the aliases list
- **Label Management**: Each alias shows its current label with "Add Label" or "Edit Label" buttons
- **Inline Editing**: Click to edit labels with Save/Cancel buttons
- **Keyboard Shortcuts**: Press Enter to save, Escape to cancel when editing

## 3. Features

### Message Grouping
- Messages are automatically grouped by the alias they were sent to
- Each group displays:
  - The alias label (or "Unlabeled")
  - The alias email address
  - Message count for that alias
  - All messages sent to that alias

### Label Management
- Labels can be added/edited from both the Messages and Aliases pages
- Labels are optional - aliases without labels show as "Unlabeled" or "(none)"
- Changes are saved to Supabase and synced across views
- Keyboard shortcuts: Enter to save, Escape to cancel

### Real-time Updates
- The messages page maintains real-time subscription to message changes
- When new messages arrive, they're automatically grouped into the correct alias
- Label changes update immediately in the UI

## 4. User Interface

### Messages Page
- Messages are displayed in collapsible groups by alias
- Each group has a header showing:
  - Label (with edit button)
  - Alias address and message count
- Messages within each group show:
  - Subject
  - From address
  - Received time
  - Attachments (with preview for images)

### Aliases Page
- Each alias is displayed in a card showing:
  - Alias email address
  - Creation date
  - Current label (with edit button)

## 5. Technical Details

### Data Flow
1. On page load, both aliases and messages are fetched
2. Aliases are stored in a map for quick lookup
3. Messages are grouped by matching their `to_addresses` with alias addresses
4. Groups are sorted by the most recent message in each group

### Type Safety
All TypeScript types have been properly annotated:
- `Alias` type includes optional `label` field
- `GroupedMessages` type for message groups
- Proper JSDoc comments for all functions

### Performance
- Aliases are loaded once and cached
- Grouping happens in-memory after data fetch
- Real-time updates trigger re-grouping automatically
- Signed URLs for attachments are batched for efficiency

## 6. Usage

1. **Run the SQL migration** in your Supabase dashboard
2. **Navigate to the Messages page** to see grouped messages
3. **Click "Add Label" or "Edit Label"** on any alias to set a label
4. **Labels are saved automatically** and appear on both Messages and Aliases pages

## 7. Troubleshooting

### Issue: Getting 204 No Content but label not updating

A 204 response is actually a **success** response from Supabase, but if the label isn't updating, the most common causes are:

1. **Missing RLS UPDATE Policy**: The aliases table needs an UPDATE policy that allows the current user to update their own aliases. See the RLS section above.

2. **Check the console logs**: The updated code now logs detailed information:
   - Open browser DevTools (F12)
   - Go to Console tab
   - Try updating a label
   - Look for logs showing:
     - "Updating alias label:" with the aliasId and newLabel
     - "Update response:" showing the data returned
     - "Label updated successfully" if it worked
     - Error messages if something failed

3. **Verify the alias ID**: Make sure the correct alias ID is being passed to the update function.

4. **Check your RLS policies**:
   ```sql
   -- Run this in Supabase SQL Editor to see current policies
   SELECT * FROM pg_policies WHERE tablename = 'aliases';
   ```

5. **Test the update directly in SQL**:
   ```sql
   -- Replace YOUR_ALIAS_ID and 'Test Label' with actual values
   UPDATE aliases 
   SET label = 'Test Label' 
   WHERE id = 'YOUR_ALIAS_ID' AND user_id = auth.uid();
   ```

### Issue: Label updates but UI doesn't refresh

The code now includes `.select()` in the update query, which returns the updated row. If the update succeeds but the UI doesn't refresh:
- Check the console for any JavaScript errors
- Verify that `loadAliases()` is being called after the update
- Clear your browser cache and reload

## 8. Notes

- The label field is optional (can be NULL in the database)
- If a message is sent to multiple aliases, it will appear in multiple groups
- Messages not sent to any known alias won't appear in the grouped view
- Labels can be any text string (no length restrictions in database, but consider UI display)

