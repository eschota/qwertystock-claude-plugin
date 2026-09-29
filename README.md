# Qwertystock for Claude

![Qwertystock](assets/qwertystock-mark-128.png)

Find, preview and license royalty-free stock media without leaving the conversation. [Qwertystock](https://qwertystock.com) is a stock marketplace with more than 1.5 million photos, illustrations, vectors and 4K videos, and its search understands meaning as well as keywords, in any language.

With this plugin, Claude can:

- **Search the catalog** by describing what you need, such as "drone shot of a lighthouse in a storm" or "flat vector icons for a coffee shop menu", and filter by photo, illustration, vector or video.
- **Show you the results**: titles, sizes, video durations, formats with prices in US dollars, item pages and free watermarked previews. Claude also looks at the thumbnails, so it can drop results that don't match.
- **Buy the full-resolution file** you picked, in the format you choose, after you confirm the item and the price. It then gives you the download link and can save the file into your project.
- **Explain the licence** in plain language, with a link to the full agreement.

## Use it

Ask in your own words, for example:

- "Find a few 4K videos of a city bus at night for a travel vlog intro."
- "I need a hero image for a bakery landing page: warm, morning light, croissants."
- "Show me vector icons of coffee cups I could use on a menu."
- "Buy #3011233 in 4K and save it to `assets/`."

In Claude Code and Cowork you can also run the commands directly:

- `/qwertystock:find <what you need>` searches and presents the best matches.
- `/qwertystock:buy <item ID or link> [format]` looks the item up, tells you the price and buys it only after you confirm.

## What's inside

| Component | What it does |
| - | - |
| `stock-media-search` skill | Tells Claude when and how to search: choosing the content type, writing visual queries, checking thumbnails, refining and presenting picks. |
| `stock-media-licensing` skill | The buying procedure with explicit price confirmation, result handling, saving files, and a plain-language licence summary. |
| `find` and `buy` commands | Shortcuts for the two workflows above. |
| `qwertystock` connector | A small local MCP server in `server/qwertystock-mcp.mjs` with three tools: `search_media`, `get_item` and `purchase_download`. |

## Where it works

- **Claude Code** and **Cowork sessions on your computer** load everything. The connector is a local MCP server, so it needs [Node.js](https://nodejs.org) 18 or newer on your computer. It uses only Node's built-in modules and installs no packages.
- **claude.ai chat** loads the skills but not the local connector. Claude can still use the public Qwertystock API where it can make web requests, and otherwise sends you to the website.

## Paid downloads and your API key

Searching and previews are free and need no account. To buy full-resolution files:

1. Sign in at [qwertystock.com/api](https://qwertystock.com/api) and copy your API key. It starts with `qs_live_`.
2. Enter it in the plugin's settings: in Claude Code, run `/plugin configure qwertystock@<marketplace>`, for example `/plugin configure qwertystock@qwertystock` when you installed from this repository, or open `/plugin` and configure the plugin there. Claude Code keeps the key in your system's secure credential store, not in a settings file.
3. Top up your Qwertystock balance on the website. Purchases are paid from that balance in US dollars.

Claude asks you to confirm the item, format and price before every purchase, and the `purchase_download` tool refuses to buy when the listed price is higher than the price you confirmed. A purchase is permanent: downloading the same or a lower format of that item again is free, and upgrading to a higher format charges only the difference. Cowork doesn't prompt for plugin settings, so in Cowork, buy on the item page on the website.

## Data and privacy

The plugin sends data only to Qwertystock, over HTTPS:

- **Search requests** to `https://qwertystock.com/api/v1/search` and `/api/v1/search/semantic`: your search text, the content type, the page and the number of results.
- **Item lookups** to `https://qwertystock.com/api/v1/download` with `format: preview`: an item ID. This returns the item's public details and free preview link. Search also uses it to fill in prices that the search results leave out.
- **Purchases** to the same endpoint: the item ID and the format. Your API key goes in the `Authorization` header of these requests and of no others.
- **Thumbnails**: the connector downloads the thumbnail images at the URLs the API returns, which are on Qwertystock's preview servers, and passes them to Claude.

Every request carries the user agent `qwertystock-claude-plugin/<version>`. The plugin stores nothing on your computer, writes no files by itself, and has no analytics or telemetry. Qwertystock records API usage, such as request counts, downloads and spending, for each API key, and shows it on your `/api` page. Requests to Qwertystock are covered by its [Privacy Policy](https://qwertystock.com/html/pages/privacy_policy.html) and [Terms of Service](https://qwertystock.com/html/pages/terms_of_service.html).

## Licence of the media

Files you buy are licensed under the [Qwertystock Royalty-Free End User License Agreement](https://qwertystock.com/html/pages/royalty_free_license.html). Watermarked previews are for evaluation and mockups only.

## Install

The plugin is submitted to the Claude plugin directory. Until it's listed there, you can add it to Claude Code from this repository:

```bash
claude plugin marketplace add eschota/qwertystock-claude-plugin
claude plugin install qwertystock@qwertystock
```

To try a local copy for one session, run `claude --plugin-dir ./qwertystock-claude-plugin`.

## Development

`node tests/smoke-test.mjs` starts the connector and checks every tool against the live API. It makes free requests only and never buys anything.

## Support

Questions and problems: [support@qwertystock.com](mailto:support@qwertystock.com) or [open an issue](https://github.com/eschota/qwertystock-claude-plugin/issues).

## License

The plugin's code and documentation are released under the [MIT License](LICENSE).
