# Contributing Templates

Template contributions are welcome. Just submit your exported snapshot via PR in `templates/custom/<template name>`
Make sure the snapshot has set `type` from `snapshot` to `content-template`, you have to do this manually.

## What Makes a Good Template

- clear service title
- valid website/fqdn info (do not submit your local adresses)
- realistic default port (if known)
- useful default config path(s)
- stable icon URL (use selfh.st CDN if available)

## Where to Place Files

Add your JSON to `templates/custom/<template name>` and run the updater to generate the updated index file

## Submission Tips

1. Keep fields concise and operationally useful.
2. Base your JSON on existing templates for consistency. (that's easiest with exporting a snapshot and changing the `type` to `content-template`)
3. Validate your template rebuilding the `index` file via the `updater.sh` or `updater.cmd` and selecting generate index files.
