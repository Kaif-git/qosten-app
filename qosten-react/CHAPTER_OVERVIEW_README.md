# Chapter Overview Feature

## Overview
The Chapter Overview feature allows you to store and display structured chapter summaries with support for:
- Hierarchical bullet points (topics → points → subpoints)
- LaTeX mathematical formulas
- Markdown formatting (bold, italic)
- Dynamic JSON structure for flexible content organization

## Database Structure

### Table: `chapter_overviews`
```sql
- id: UUID (Primary Key)
- name: VARCHAR(255) - Chapter name/title
- overview_data: JSONB - Structured overview content
- subject: VARCHAR(100) - e.g., "Physics", "Chemistry"
- grade_level: VARCHAR(50) - e.g., "High School", "Grade 10"
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## JSON Structure

The `overview_data` column uses the following JSON schema:

```json
{
  "topics": [
    {
      "id": "T-01",
      "title": "Topic Title",
      "points": [
        {
          "text": "Main point text with **bold** and *italic* markdown, plus \\( LaTeX \\) formulas",
          "subpoints": [
            "Subpoint 1 with \\( inline \\) math",
            "Subpoint 2"
          ]
        }
      ]
    }
  ]
}
```

### JSON Schema Details

- **topics**: Array of topic objects
  - **id**: Unique identifier (e.g., "T-01", "T-02")
  - **title**: Topic heading
  - **points**: Array of point objects
    - **text**: Main bullet point text (supports markdown & LaTeX)
    - **subpoints**: Array of sub-bullet strings (optional, can be empty array)

## LaTeX Support

Use these delimiters in your text:
- **Inline math**: `\( formula \)` - Example: `\( E = mc^2 \)`
- **Display math**: `\[ formula \]` - Example: `\[ \frac{1}{2}mv^2 \]`

**Important**: In SQL, escape backslashes:
- JSON: `"\\( E = mc^2 \\)"`
- SQL string: `'\\\\( E = mc^2 \\\\)'`

## Markdown Support

- **Bold**: `**text**` → **text**
- *Italic*: `*text*` → *text*

## Adding New Overviews

### Method 1: Using the Upload Interface (Recommended)

1. Navigate to **⬆️ Upload Overview** tab
2. Paste your markdown-formatted text (see format below)
3. Fill in:
   - **Chapter Name** (required)
   - **Subject** (optional)
   - **Grade Level** (optional)
4. Click **🔍 Parse & Preview** to validate and preview
5. Review the generated JSON and preview
6. Click **⬆️ Upload to Database** to save

#### Text Format for Upload

Use this markdown format:

```markdown
### T-01: Topic Title
*   **Point Title:** Description with \\( LaTeX \\) formulas
*   **Another Point:**
    *   Subpoint 1
    *   Subpoint 2 with \\( x = 5 \\)

### T-02: Another Topic
*   **Definition:** Description here
```

**Important Notes:**
- Use `###` for topic headers with format: `### T-XX: Title`
- Use `*` (with 0-4 spaces) for main bullet points
- Use `*` (with 5+ spaces) for sub-bullet points
- LaTeX formulas use `\\(` and `\\)` for inline math
- Markdown bold `**text**` and italic `*text*` supported

### Method 2: Direct SQL Insert
```sql
INSERT INTO chapter_overviews (name, overview_data, subject, grade_level) 
VALUES (
  'Your Chapter Name',
  '{
    "topics": [
      {
        "id": "T-01",
        "title": "First Topic",
        "points": [
          {
            "text": "Point with \\\\( x = 5 \\\\)",
            "subpoints": ["Sub 1", "Sub 2"]
          }
        ]
      }
    ]
  }'::jsonb,
  'Subject Name',
  'Grade Level'
);
```

### Method 2: Using Supabase Dashboard
1. Go to Supabase Table Editor
2. Select `chapter_overviews` table
3. Click "Insert row"
4. Fill in the fields with your JSON data

## Using the Component

### Access the Overview Tab
1. Navigate to the app
2. Click on "📚 Chapter Overview" tab
3. Select a chapter from the dropdown
4. View the formatted overview with topics, points, and LaTeX rendering

### Features
- **Dropdown selector**: Choose between multiple chapter overviews
- **Automatic LaTeX rendering**: Math formulas display beautifully
- **Hierarchical display**: Topics → Points → Subpoints with proper nesting
- **Markdown formatting**: Bold and italic text rendered properly
- **Responsive layout**: Clean, card-based design

## Example Data Structure

Here's a complete example for a Physics chapter:

```json
{
  "topics": [
    {
      "id": "T-01",
      "title": "Work",
      "points": [
        {
          "text": "**Definition:** Work is done when a force causes an object to move.",
          "subpoints": []
        },
        {
          "text": "**Formula:** \\( W = F \\times s \\), where:",
          "subpoints": [
            "\\( W \\) is Work",
            "\\( F \\) is the Force applied",
            "\\( s \\) is the Displacement"
          ]
        }
      ]
    },
    {
      "id": "T-02",
      "title": "Energy",
      "points": [
        {
          "text": "**Definition:** Energy is the ability to do work.",
          "subpoints": []
        }
      ]
    }
  ]
}
```

## Migration

To apply the database migration:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL file in Supabase SQL Editor
# File: supabase/migrations/003_create_chapter_overviews_table.sql
```

## Component Location

- **Component**: `src/components/ChapterOverview/ChapterOverview.jsx`
- **Route**: `/overview`
- **Tab**: Added to `TabContainer.jsx`

## Accessing Data Dynamically

In the component, you can access any part of the JSON structure:

```javascript
// Access a specific topic
const firstTopic = selectedOverview.overview_data.topics[0];

// Access topic title
const title = firstTopic.title; // "Work"

// Access first point text
const pointText = firstTopic.points[0].text;

// Access subpoints
const subpoints = firstTopic.points[1].subpoints;

// Iterate through all topics
selectedOverview.overview_data.topics.forEach(topic => {
  console.log(topic.title);
  topic.points.forEach(point => {
    console.log(point.text);
    point.subpoints.forEach(sub => console.log(sub));
  });
});
```

## Tips

1. **Testing LaTeX**: Use an online LaTeX editor to test formulas before adding them
2. **Escaping**: Remember to escape backslashes in SQL (double them)
3. **Empty arrays**: Use `[]` for points without subpoints, not `null`
4. **Validation**: The component handles missing data gracefully
5. **Long content**: The component scrolls naturally for long chapters

## Future Enhancements

Possible additions:
- Admin UI for adding/editing overviews
- Search within overviews
- Export to PDF
- Print-friendly view
- Collapsible topics
- Filter by subject/grade
