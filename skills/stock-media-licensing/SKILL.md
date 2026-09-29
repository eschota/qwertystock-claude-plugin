---
name: stock-media-licensing
description: Buy and download full-resolution Qwertystock files and answer licensing questions about them. Use when the user wants to buy or license a Qwertystock photo, video, illustration or vector, needs the file without a watermark or in 4K, FHD, HD or original quality, wants it saved into a project, or asks whether a Qwertystock file may be used for a purpose.
---

# Buy and license Qwertystock files

Buying spends the user's money. Follow every step in order.

## Before buying

1. **Identify the item and the format.** If you only have a description, search first with the `stock-media-search` skill. Look the item up with the `get_item` tool to read its formats and prices.
2. **Match the format to the use.** Suggest the smallest format that is enough:
   - web pages, social posts and slides: `HD` or `FHD`,
   - print, large displays and heavy cropping: `4K` or `8K` for photos and illustrations,
   - video edits: the project's resolution, usually `FHD` or `4K`,
   - vectors: `original`, the editable EPS file.
3. **Ask for explicit confirmation** with the exact item ID, title, format and price in USD, for example: "Buy #3011233 *Vintage red convertible* in 4K for $4?" Wait for a clear yes. A general request such as "get me a good picture" is not a confirmation. Confirm each purchase separately.

## Buying

Call the `purchase_download` tool with `item_id`, `format`, and `max_price_usd` set to the price the user confirmed. The tool refuses when the listed price is higher than that amount.

Handle the result:

- **Ready**: give the user the download link and what was charged. A charge of $0 means they already own that format or a higher one. The link is personal, so don't publish it, paste it into shared documents or commit it to a repository.
- **Still preparing**, which happens with videos: nothing is charged until the file is ready. Wait a minute, then call the tool again with the same arguments; a repeat never charges twice.
- **Balance too low**: tell the user how much is needed and give them the top-up link from the result.
- **No API key, or the key was rejected**: the user signs in at https://qwertystock.com/api, copies their API key (it starts with `qs_live_`) and enters it in the plugin's settings. In Claude Code they run `/plugin configure qwertystock@<marketplace>`, for example `/plugin configure qwertystock@qwertystock`, or open `/plugin` and configure the qwertystock plugin there. Never ask the user to paste the key into the chat, and never print or log a key.
- **Tools not available**, for example in claude.ai chat: send the user to the item page `https://qwertystock.com/item?id=<id>` to buy it on the website.

A purchase is permanent. Downloading the same or a lower format of the same item again is free, and moving up to a higher format charges only the difference.

## Saving the file

When the user wants the file in their project and you can run shell commands, download the link to the path they name, for example:

```bash
curl -fL -o assets/hero-convertible-4k.jpg "<download link>"
```

Use a descriptive file name with the item ID, and keep the link itself out of files you write.

## Licensing questions

Every download is licensed under the Qwertystock Royalty-Free End User License Agreement: https://qwertystock.com/html/pages/royalty_free_license.html. Summarise it in plain language when asked, and link to it. The main points of the agreement:

- The licence is perpetual, worldwide, non-exclusive and non-transferable. The licensee may modify the content and use it in their own work or a client's work.
- One licence covers one person; each person who uses the content needs their own account.
- The standard image licence covers websites, apps, social media, online ads and e-publications. It also covers printed use up to 500,000 copies, outdoor campaigns under 500,000 impressions, and film or video productions with budgets up to SGD 20,000.
- The standard video licence covers web, social and app productions with audiences up to 500,000, live performances up to that size, and websites. Broadcast, cable, streaming-service and cinema distribution need the enhanced video licence.
- Merchandise for resale, templates for sale, and uses above the standard limits need an enhanced licence.
- Content marked Editorial Use Only may not be used commercially.
- It is never allowed to resell or share the files as stand-alone files, to use content as a logo or trademark, or to show people in the content in sensitive contexts. Those contexts include adult, political, tobacco and health contexts, and other uses the agreement restricts.

This is a summary, not legal advice; the agreement's text decides. When a planned use goes beyond the standard limits, tell the user before they buy, and suggest they check with Qwertystock support at support@qwertystock.com.
