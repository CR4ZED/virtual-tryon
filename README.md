# Virtual Try-On

A Chrome extension that shows you wearing clothes from any online store (Amazon, Flipkart, Myntra, Shopify stores and more) using your own Google Gemini or OpenAI API key. Nothing is hosted: the extension runs in your browser and talks directly to the AI provider you choose.

## Features

- A **Try On** button appears automatically on clothing product pages, styled like the store's own "Add to cart" button.
- Photorealistic try-on that keeps your face, body, skin and proportions unchanged.
- Before/after slider to compare.
- **Pick image** mode: click any photo on the page when the automatic choice is wrong.
- One cart across all stores, grouped by store, with try-on previews and notes.

## Requirements

- Google Chrome 116 or newer
- Node.js 20 or newer
- An API key from [Google AI Studio](https://aistudio.google.com/apikey) (recommended) or [OpenAI](https://platform.openai.com/api-keys). Image generation is billed by the provider to your account.

## Install

```bash
git clone <this repo> virtual-tryon
cd virtual-tryon
npm install
```

If your npm config blocks install scripts, run `npx wxt prepare` once after `npm install`.

```bash
npm run build
```

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
4. Pin the extension from the puzzle-piece menu.

The Settings page opens from the extension's side panel (gear icon) or from `chrome://extensions` → Details → Extension options.

## Set up

1. **Paste one or both API keys and click Save and verify keys.** The extension checks each key by listing its image models, then you pick a model from one dropdown grouped by provider. Keys are entered in Settings, not in a `.env` file. Anything in a `.env` file would be compiled into the extension's JavaScript, where anyone with the folder could read it. Settings stores the key in the extension's private browser storage, which web pages and the extension's content scripts cannot read.
2. **Upload 1–4 photos.** Mark the best one as primary; it is the photo that gets dressed. The others help the AI keep your identity.
   - Full body, head to feet, facing the camera
   - Even light, plain background, nobody else in the frame
   - Fitted clothing, nothing covering your body
   - JPEG, PNG or WebP, up to 10 MB each

## Use

1. Open any clothing product page and click **Try On** (or click the extension icon). The side panel opens next to the page.
2. Check the product image in the panel. If it is wrong, choose a thumbnail or click **Pick image** and click the photo on the page.
3. Choose which of your photos to use and whether to match the model's pose.
4. Click **Try it on**. Generation takes about 10–40 seconds.
5. Drag the slider to compare, download the image, or add the item to your cart.

## Privacy

- Your photos, keys, results and cart are stored only in this browser profile.
- When you click **Try it on**, your photos and the product image are sent directly to the provider you selected. Nothing is sent anywhere else.
- Photos are resized to 1536 px and re-encoded on upload, which removes location and camera metadata.
- The extension downloads the product image itself, without cookies. If a store redirects that download, the browser follows the redirect before the extension can check it; the extension then rejects private or local addresses and discards the response.
- **Settings → Delete all data** removes everything.

## Development

```bash
npm run dev        # opens a Chrome instance with the extension and hot reload
npm test           # unit tests
npm run typecheck
npm run build      # production build in .output/chrome-mv3
npm run zip        # zip for sharing
```

## Troubleshooting

| Problem | Fix |
|---|---|
| No Try On button | The page may not be detected as clothing. Click the extension icon and use **Pick image**. Tabs opened before installing need a reload. |
| "rejected the API key" | Check the key in Settings and that billing is enabled for image generation on your provider account. |
| "Could not download the product image" | Some stores block image downloads. Use **Pick image** and choose another photo. |
| Model not found | The provider retired the model. Open Settings, click Save and verify keys, and pick another model. |

## Manual test checklist

- [ ] Button appears and matches the theme on Amazon.in, Flipkart, Myntra and one Shopify store
- [ ] No button on a non-clothing product (phone, shoes) or a blog page
- [ ] Button reappears after navigating to another product (single-page navigation)
- [ ] Picker highlights images, Esc cancels, click selects and the page does not navigate
- [ ] Gemini and OpenAI each generate a result; the face and body match the original
- [ ] Cancel during generation returns to idle without an error
- [ ] Switch tabs during generation; the result appears when you return
- [ ] Invalid key shows the settings prompt
- [ ] Slider works with mouse and arrow keys
- [ ] Cart persists after restarting Chrome; "Shop at" opens the product tabs
- [ ] Delete all data clears photos, keys and cart
