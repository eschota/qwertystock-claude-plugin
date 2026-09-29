---
description: Buy and download a full-resolution Qwertystock file by item ID
argument-hint: <item ID or item page link> [format such as HD, FHD, 4K or original]
---

The user wants to buy this Qwertystock file: $ARGUMENTS

Follow the `stock-media-licensing` skill:

1. Look the item up with the `get_item` tool. Accept an item page link such as `https://qwertystock.com/item?id=3011233` and use its `id`.
2. If no format was given, suggest one that fits the user's purpose.
3. State the item ID, title, format and price in USD, and ask the user to confirm. Wait for a clear yes.
4. Only then call `purchase_download` with `max_price_usd` set to the confirmed price, and report the result.
