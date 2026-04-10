> # Project Template

To add a new project, edit `src/data/projects.json` and add an entry to the `projects` array:

## Project Structure

```json
{
  "title": "Project Name",
  "description": "Brief one-line description of what this project does",
  "github": "username/repo-name",
  "url": "https://live-demo-url.com",
  "tech": ["React", "TypeScript", "Node.js"],
  "featured": true
}
```

## Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Project name |
| `description` | string | Yes | Short description (1-2 sentences) |
| `github` | string | Yes | Repository in "username/repo" format |
| `url` | string | No | Live demo or production URL |
| `tech` | string[] | No | Array of technology tags |
| `featured` | boolean | No | Highlight on page (default: false) |

## Example

```json
{
  "projects": [
    {
      "title": "TERRELLA",
      "description": "A web application for exploring and visualizing data",
      "github": "shuhanluo/TERRELLA",
      "url": "https://terrella.vercel.app/",
      "tech": ["React", "TypeScript", "Next.js"],
      "featured": true
    },
    {
      "title": "Half-Life-2-VSCode-Soundpack",
      "description": "A VSCode extension that brings Half-Life 2 sounds to your editor",
      "github": "shuhanluo/Half-Life-2-VSCode-Soundpack",
      "url": null,
      "tech": ["TypeScript", "VSCode Extension API"],
      "featured": false
    }
  ],
  "githubUsername": "shuhanluo"
}
```

## Notes

- Featured projects are displayed first in a highlighted section
- Projects without a `url` will only show the GitHub link
- The `githubUsername` field is used for the "View all projects on GitHub" footer link