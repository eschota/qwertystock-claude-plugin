---
name: stock-media-search
description: Find royalty-free stock photos, videos, illustrations and vectors on Qwertystock. Use when the user needs stock footage, b-roll, a background or hero image, an illustration, a vector graphic or icon, or visuals for a website, app, presentation, ad, social post, article or video edit, or when they ask to search Qwertystock.
---

# Find stock media on Qwertystock

Qwertystock is a royalty-free stock marketplace with more than 1.5 million photos, illustrations, vectors and videos. Its search understands meaning, not only exact keywords, and accepts queries in any language.

## Workflow

1. **Work out what the user needs.** Note the subject, action, setting, mood or style, orientation, and where the media will be used. Ask one short question only when the request is too vague to search at all; otherwise search first and refine.
2. **Pick the content type.**
   - `video` for footage, b-roll, clips, loops and backgrounds for video edits.
   - `vector` for editable graphics, icons, logos-style marks, patterns and anything that must scale.
   - `illustration` for drawn, painted or 3D-rendered art.
   - `photo` otherwise. Leave the type out when any kind would do.
3. **Search** with the `search_media` tool of the Qwertystock connector. Write the query as a short visual description, for example `aerial view of a turquoise lagoon with a wooden pier`, rather than a list of loose tags. Keep the default of 12 results and 4 thumbnails unless the user wants more.
4. **Check the thumbnails** that come back as images. Drop results that don't match what the user asked for, even when their titles look right.
5. **Refine once or twice when the matches are weak:** make the scene more concrete, use synonyms, remove the type filter, or set `mode` to `semantic` for moods and abstract ideas such as "calm", "success" or "loneliness". Use `page` for more results of a good query.
6. **Present the best 3 to 6 picks**, not the raw tool output. For each pick give:
   - the title and item ID,
   - the type, the size in pixels or the duration of a video,
   - the price range across formats in USD,
   - the item page link and the watermarked preview link.

   Say which pick you recommend for the user's purpose and why, in one sentence.
7. **Look up a single item** with `get_item` when the user gives an ID or an item page link such as `https://qwertystock.com/item?id=3011233`.

## Rules

- Previews and thumbnails carry a watermark. They are fine for mockups, drafts and client approval, not for final use.
- Searching and previews are free. Never buy anything from this skill. When the user wants the full-resolution file or asks about licensing, follow the `stock-media-licensing` skill.
- Don't show internal ranking values such as semantic scores or distances.
- Prices are in US dollars, per download and per format.

## When the Qwertystock tools are not available

In claude.ai chat, or where the plugin's connector could not start, the tools above are missing. Then use the public REST API if you can make web requests, for example with a web fetch tool or `curl`:

```text
GET https://qwertystock.com/api/v1/search?q=<URL-encoded query>&type=<photo|illustration|vector|video>&limit=<1-80>&page=<n>
GET https://qwertystock.com/api/v1/search/semantic?q=<URL-encoded query>&limit=<1-80>
```

Each result has `id`, `title`, `type`, `width`, `height`, `duration` for videos, `formats`, `prices` in USD, `thumbnail_url`, and `preview_url` or `video_preview_url`. The item page is `https://qwertystock.com/item?id=<id>`. If you cannot make web requests either, send the user to `https://qwertystock.com` with a suggested search query.
