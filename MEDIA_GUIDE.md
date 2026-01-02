# 📚 Argn Media Management Guide

## 📖 Table of Contents
1. [Quick Start](#quick-start)
2. [Media JSON Structure](#media-json-structure)
3. [Step-by-Step Guide to Adding Media](#step-by-step-guide)
4. [Media Types](#media-types)
5. [Uploading to Catbox.moe](#uploading-to-catboxmoe)
6. [Best Practices](#best-practices)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

Adding media to Argn is simple! You only need to edit the `media.json` file and add a new entry to the `"media"` array. The system will automatically display it on the website.

---

## 📋 Media JSON Structure

The `media.json` file contains an array of media objects. Here's the complete structure:

```json
{
  "media": [
    {
      "id": "unique_identifier",
      "type": "image|video|gif|file",
      "link": "https://direct-url-to-file",
      "title": "Display Title",
      "description": "Detailed description of the media",
      "tags": ["tag1", "tag2", "tag3"],
      "credits": "Creator Discord Tag or Unknown",
      "submitted_by": "Discord Tag of Uploader"
    }
  ]
}
```

### Field Explanations

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String | Yes | Unique identifier for the media (can be any string, used internally) |
| `type` | String | Yes | One of: `image`, `video`, `gif`, or `file` |
| `link` | String | Yes | Direct URL to the file (must be from Catbox.moe or similar) |
| `title` | String | Yes | Title displayed on the card and detail page |
| `description` | String | Yes | Full description visible when clicking on the media |
| `tags` | Array | Yes | Array of search tags (case-insensitive, searchable) |
| `credits` | String | Yes | Creator's Discord tag (e.g., "Username#1234" or "Unknown") |
| `submitted_by` | String | Yes | Discord tag of the person who submitted it |

---

## 👣 Step-by-Step Guide to Adding Media

### Step 1: Prepare Your File
- Choose the media file you want to add (image, video, or gif)
- Supported formats:
  - **Images**: JPG, PNG, WebP, GIF
  - **Videos**: MP4, WebM, OGG
  - **GIFs**: Animated GIF
  - **Files**: Any format (shown as file icon)

### Step 2: Upload to Catbox.moe
1. Go to [catbox.moe](https://catbox.moe)
2. Click "Select File" or drag your file to upload
3. Copy the direct link provided (e.g., `https://files.catbox.moe/abc123.mp4`)
4. Keep this link handy

### Step 3: Open media.json
- Navigate to `/main/media.json` in your project
- The file contains a `"media"` array

### Step 4: Add a New Media Entry
Add a new object to the `"media"` array:

```json
{
  "id": "unique_id_here",
  "type": "image",
  "link": "https://files.catbox.moe/yourfile.jpg",
  "title": "Your Title Here",
  "description": "A detailed description of what this media is about",
  "tags": ["tag1", "tag2", "tag3"],
  "credits": "Creator#1234",
  "submitted_by": "Your#1234"
}
```

### Step 5: Save and Refresh
- Save the `media.json` file
- Refresh your Argn website in the browser
- Your media should now appear in the grid!

---

## 🎨 Media Types

### Image
```json
{
  "id": "img1",
  "type": "image",
  "link": "https://files.catbox.moe/image.jpg",
  "title": "Cool Image",
  "description": "This is an image",
  "tags": ["visual", "example"],
  "credits": "Artist#1234",
  "submitted_by": "Admin#5678"
}
```
- ✅ Displays as an image preview in grid
- ✅ Full image shown in detail view
- ✅ Supports JPG, PNG, WebP, GIF

### Video
```json
{
  "id": "vid1",
  "type": "video",
  "link": "https://files.catbox.moe/video.mp4",
  "title": "Cool Video",
  "description": "This is a video",
  "tags": ["multimedia", "example"],
  "credits": "VideoMaker#1234",
  "submitted_by": "Admin#5678"
}
```
- ✅ Shows video player with controls
- ✅ Can pause, play, fullscreen
- ✅ Supports MP4, WebM, OGG

#### YouTube links

You can also add YouTube videos directly. For `type": "video"`, a YouTube URL (e.g. `https://www.youtube.com/watch?v=VIDEO_ID` or `https://youtu.be/VIDEO_ID`) will be embedded in the detail view and show a thumbnail in the grid.

Example YouTube entry:

```json
{
  "id": "yt-001",
  "type": "video",
  "link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Example YouTube Video",
  "description": "A sample YouTube video entry (YouTube embed supported).",
  "tags": ["youtube", "music", "example"],
  "credits": "CreatorName",
  "submitted_by": "Uploader#1234"
}
```

Notes:
- The system detects YouTube links and embeds them using the official embed URL (`https://www.youtube.com/embed/VIDEO_ID`).
- For grid previews the YouTube thumbnail is shown; clicking opens the embedded player in the detail view.

### GIF
```json
{
  "id": "gif1",
  "type": "gif",
  "link": "https://files.catbox.moe/animation.gif",
  "title": "Reaction GIF",
  "description": "This is an animated gif",
  "tags": ["reaction", "animation"],
  "credits": "GifMaster#1234",
  "submitted_by": "Admin#5678"
}
```
- ✅ Displays animated GIF
- ✅ Treated like images but animated
- ✅ Perfect for memes and reactions

### File
```json
{
  "id": "file1",
  "type": "file",
  "link": "https://files.catbox.moe/document.pdf",
  "title": "PDF Document",
  "description": "An important document",
  "tags": ["document", "reference"],
  "credits": "DocumentAuthor#1234",
  "submitted_by": "Admin#5678"
}
```
- ✅ Shows file icon (📄) instead of preview
- ✅ Clicking opens the file in a new tab
- ✅ Can be any file type (PDF, ZIP, etc.)

---

## 📤 Uploading to Catbox.moe

### What is Catbox.moe?
Catbox.moe is a free file hosting service that provides direct links to files. Perfect for media distribution!

### How to Upload:

1. **Visit the site**: Go to [catbox.moe](https://catbox.moe)

2. **Select your file**:
   - Click "Select File" button
   - OR drag and drop your file onto the page

3. **Copy the link**:
   - After upload, you'll see a direct link
   - Look for the format: `https://files.catbox.moe/[randomcode].[extension]`
   - Click the link text to copy it

4. **Paste into media.json**:
   - Use this link in the `"link"` field

### File Size Limits
- Standard files: up to 200MB
- Perfect for images, videos, and documents

---

## ⭐ Best Practices

### Tags
- Use **lowercase** tags for consistency
- Use 2-5 tags per media
- Be descriptive (e.g., "discord", "meme", "funny", "gaming")
- Tags are searchable and case-insensitive
- Example: `"tags": ["discord", "bot", "screenshot", "funny"]`

### Descriptions
- Write clear, detailed descriptions (1-3 sentences)
- Explain what the media is and why it's relevant
- Be concise but informative
- Example: "A screenshot of the epic moment when the bot crashed the server with a single command"

### Credits
- Always credit the original creator if known
- Use Discord tag format: `"Username#1234"`
- If unknown, use `"Unknown"`
- Example: `"credits": "CreativeArtist#9876"`

### IDs
- Use unique identifiers (numbers, slugs, etc.)
- Example: `"id": "1"`, `"id": "epic-meme"`, `"id": "video-2025-01"`
- Keep them short and memorable

### JSON Formatting
- Always use proper JSON syntax
- Each field needs a comma except the last one
- String values must be in double quotes
- Use proper nesting and indentation

---

## 📝 Examples

### Complete Example 1: Funny Image
```json
{
  "id": "meme-001",
  "type": "image",
  "link": "https://files.catbox.moe/abc123def.png",
  "title": "When Someone Doesn't Use the Discord Search Bar",
  "description": "A relatable meme about Discord users asking questions that could be found with search",
  "tags": ["discord", "meme", "funny", "relatable"],
  "credits": "MemeCreator#4567",
  "submitted_by": "YourName#1234"
}
```

### Complete Example 2: Gaming Video
```json
{
  "id": "clip-gaming-001",
  "type": "video",
  "link": "https://files.catbox.moe/xyz789.mp4",
  "title": "First Time Playing Dark Souls",
  "description": "My epic first attempt at Dark Souls where I immediately died to the tutorial boss",
  "tags": ["gaming", "funny", "fail", "darksouls"],
  "credits": "GamerPro#8901",
  "submitted_by": "StreamViewer#5678"
}
```

### Complete Example 3: Reaction GIF
```json
{
  "id": "reaction-001",
  "type": "gif",
  "link": "https://files.catbox.moe/reaction.gif",
  "title": "When You Fix a Bug on First Try",
  "description": "The perfect reaction when your code works without debugging",
  "tags": ["reaction", "programming", "funny", "success"],
  "credits": "Unknown",
  "submitted_by": "CodeNinja#2345"
}
```

---

## 🐛 Troubleshooting

### Problem: Media doesn't show up
**Solution:**
- Check that the JSON syntax is correct (use a JSON validator)
- Ensure all required fields are present
- Verify the Catbox link is correct and working
- Refresh your browser and clear cache

### Problem: Image/Video shows broken
**Solution:**
- Verify the Catbox link is a direct link (ends with file extension)
- Check that the file still exists on Catbox
- Try re-uploading to Catbox and getting a new link

### Problem: Search doesn't find my media
**Solution:**
- Ensure your tags are spelled correctly
- Remember search is case-insensitive
- Check that tags are in the array format: `["tag1", "tag2"]`
- Try searching by title or description

### Problem: JSON file won't save
**Solution:**
- Check for syntax errors (missing commas, quotes, brackets)
- Use an online JSON validator: [jsonlint.com](https://jsonlint.com)
- Make sure you're using double quotes, not single quotes

### Problem: Links contain special characters
**Solution:**
- Catbox links sometimes have special characters
- Make sure to escape them properly in JSON
- Use a URL encoder if needed: [urlencoder.org](https://www.urlencoder.org)

---

## 📞 Need Help?

If something isn't working:
1. Check the browser console (F12) for error messages
2. Validate your JSON at [jsonlint.com](https://jsonlint.com)
3. Make sure all required fields are present
4. Verify your Catbox links are working

---

**Happy sharing! 🎉**
