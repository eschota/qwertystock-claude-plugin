# Qwertystock for Claude

![Qwertystock](assets/qwertystock-mark-128.png)

Find and preview royalty-free stock media without leaving the conversation. [Qwertystock](https://qwertystock.com) is a stock marketplace with more than 1.5 million photos, illustrations, vectors and 4K videos, and its search understands meaning as well as keywords, in any language.

With this plugin, Claude can:

- **Search the catalog** by describing what you need, such as "drone shot of a lighthouse in a storm" or "flat vector icons for a coffee shop menu", and filter by photo, illustration, vector or video.
- **Show you the results**: titles, sizes, video durations, formats with prices in US dollars, item pages and free watermarked previews. Claude also looks at the thumbnails, so it can drop results that don't match.
- **Help you license the right file**: it recommends the format for your use, checks the use against the licence, explains the price, and gives you the item page where you buy it.
- **Explain the licence** in plain language, with a link to the full agreement.

The plugin is read-only. It never buys anything, never asks for payment details, and needs no Qwertystock account or API key. You buy files yourself on qwertystock.com.

## Use it

Ask in your own words, for example:

- "Find a few 4K videos of a city bus at night for a travel vlog intro."
- "I need a hero image for a bakery landing page: warm, morning light, croissants."
- "Show me vector icons of coffee cups I could use on a menu."
- "Which format of #3011233 do I need for a printed A3 poster, and may I use it on a product label?"

In Claude Code and Cowork you can also run the commands directly:

- `/qwertystock:find <what you need>` searches and presents the best matches.
- `/qwertystock:license <item ID or link> [how you'll use it]` recommends a format, checks the licence and gives you the link to buy.

## What's inside

| Component | What it does |
| - | - |
| `stock-media-search` skill | Tells Claude when and how to search: choosing the content type, writing visual queries, checking thumbnails, refining and presenting picks. |
| `stock-media-licensing` skill | Choosing a format for the use, explaining prices, a plain-language licence summary, and handing over the item page. |
| `find` and `license` commands | Shortcuts for the two workflows above. |
| `qwertystock` connector | A small local MCP server in `server/qwertystock-mcp.mjs` with two read-only tools: `search_media` and `get_item`. |

## Where it works

- **Claude Code** and **Cowork sessions on your computer** load everything. The connector is a local MCP server, so it needs [Node.js](https://nodejs.org) 18 or newer on your computer. It uses only Node's built-in modules and installs no packages.
- **claude.ai chat** loads the skills but not the local connector. Claude can still use the public Qwertystock API where it can make web requests, and otherwise sends you to the website.

## Buying files

Previews carry a watermark and are meant for evaluation, mockups and client approval. To use a file for real, open its item page, `https://qwertystock.com/item?id=<id>`, sign in and buy the format you need. Prices are per file and format, in US dollars. A purchase is permanent: downloading the same or a lower format of that item again is free, and upgrading to a higher format costs only the difference. After you buy, Claude Code can save the file into your project if you give it the download link.

## Data and privacy

The connector sends data only to Qwertystock, over HTTPS, and sends no credentials:

- **Search requests** to `https://qwertystock.com/api/v1/search` and `/api/v1/search/semantic`: your search text, the content type, the page and the number of results.
- **Item lookups** to `https://qwertystock.com/api/v1/download` with `format: preview`, which is free and returns an item's public details and preview link: the item ID. Search also uses it to fill in prices that the search results leave out.
- **Thumbnails**: the connector downloads the thumbnail images at the URLs the API returns, which are on Qwertystock's preview servers, and passes them to Claude.

Every request carries the user agent `qwertystock-claude-plugin/<version>`. The plugin stores nothing on your computer, writes no files by itself, reads nothing from your conversation beyond the search text and item IDs above, and has no analytics or telemetry. Requests to Qwertystock are covered by its [Privacy Policy](https://qwertystock.com/html/pages/privacy_policy.html) and [Terms of Service](https://qwertystock.com/html/pages/terms_of_service.html).

## Licence of the media

Files bought on Qwertystock are licensed under the [Qwertystock Royalty-Free End User License Agreement](https://qwertystock.com/html/pages/royalty_free_license.html). The `stock-media-licensing` skill summarises it, but the agreement's text decides.

## Troubleshooting

- **Claude says the Qwertystock tools aren't available.** In Claude Code, run `/mcp` and check that the `plugin:qwertystock:qwertystock` server is connected. If it failed to start, check that `node --version` prints 18 or newer in the terminal you start Claude from, then restart the session. In claude.ai chat the connector doesn't load by design; see [Where it works](#where-it-works).
- **"Qwertystock rate limit reached".** The public API allows about 120 searches a minute from one address. Wait a minute and try again.
- **"Could not reach Qwertystock".** Check your internet connection, and that a proxy or firewall allows HTTPS to `qwertystock.com`.
- **No or few results.** Describe the scene more concretely, drop the content type filter, or ask Claude to use semantic search for moods and abstract ideas.
- **Prices missing for some results.** Ask Claude to look up the item; `get_item` always returns its prices.

## Install

The plugin is submitted to the Claude plugin directory. Until it's listed there, you can add it to Claude Code from this repository:

```bash
claude plugin marketplace add eschota/qwertystock-claude-plugin
claude plugin install qwertystock@qwertystock
```

To try a local copy for one session, run `claude --plugin-dir ./qwertystock-claude-plugin`.

## Development

`node tests/smoke-test.mjs` starts the connector and checks both tools against the live API with free, read-only requests.

## Support

Questions and problems: [support@qwertystock.com](mailto:support@qwertystock.com) or [open an issue](https://github.com/eschota/qwertystock-claude-plugin/issues).

## License

The plugin's code and documentation are released under the [MIT License](LICENSE).
