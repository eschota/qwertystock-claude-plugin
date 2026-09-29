---
name: stock-media-licensing
description: Choose the right format and licence for a Qwertystock photo, video, illustration or vector, explain the price, and point the user to where they buy it. Use when the user wants to buy or license a Qwertystock file, needs it without a watermark or in 4K, FHD, HD or original quality, asks what a file costs, or asks whether a Qwertystock file may be used for a purpose.
---

# License Qwertystock files

This plugin never buys anything and never handles payment. The user buys files themselves on qwertystock.com. Your job is to help them pick the right item, format and licence, and to hand them the link.

## Help the user choose

1. **Identify the item.** If you only have a description, search first with the `stock-media-search` skill. Look the item up with the `get_item` tool to read its formats and prices. Accept an item page link such as `https://qwertystock.com/item?id=3011233` and use its `id`.
2. **Match the format to the use.** Suggest the smallest format that is enough:
   - web pages, social posts and slides: `HD` or `FHD`,
   - print, large displays and heavy cropping: `4K` or `8K` for photos and illustrations,
   - video edits: the project's resolution, usually `FHD` or `4K`,
   - vectors: the original editable file, listed as `eps`.
3. **State the price** of that format in US dollars from the `get_item` result, and mention the cheaper and more expensive options when they matter.
4. **Check the planned use against the licence**, using the summary below. When the use goes beyond the standard limits, say so before the user buys.
5. **Give the item page link** `https://qwertystock.com/item?id=<id>`. The user signs in there, chooses the format and pays. Purchases are permanent: downloading the same or a lower format of that item again is free, and moving up to a higher format costs only the difference.

## After the user has bought the file

When the user gives you the file or its download link and wants it in their project, and you can run shell commands, save it to the path they name, for example:

```bash
curl -fL -o assets/hero-convertible-4k.jpg "<download link>"
```

Use a descriptive file name with the item ID. Download links are personal, so keep them out of files you write, shared documents and repositories.

## Licence summary

Every purchase is licensed under the Qwertystock Royalty-Free End User License Agreement: https://qwertystock.com/html/pages/royalty_free_license.html. Summarise it in plain language when asked, and link to it. The main points of the agreement:

- The licence is perpetual, worldwide, non-exclusive and non-transferable. The licensee may modify the content and use it in their own work or a client's work.
- One licence covers one person; each person who uses the content needs their own account.
- The standard image licence covers websites, apps, social media, online ads and e-publications. It also covers printed use up to 500,000 copies, outdoor campaigns under 500,000 impressions, and film or video productions with budgets up to SGD 20,000.
- The standard video licence covers web, social and app productions with audiences up to 500,000, live performances up to that size, and websites. Broadcast, cable, streaming-service and cinema distribution need the enhanced video licence.
- Merchandise for resale, templates for sale, and uses above the standard limits need an enhanced licence.
- Content marked Editorial Use Only may not be used commercially.
- It is never allowed to resell or share the files as stand-alone files, to use content as a logo or trademark, or to show people in the content in sensitive contexts. Those contexts include adult, political, tobacco and health contexts, and other uses the agreement restricts.

This is a summary, not legal advice; the agreement's text decides. For uses beyond the standard limits, suggest the user check with Qwertystock support at support@qwertystock.com before buying.
