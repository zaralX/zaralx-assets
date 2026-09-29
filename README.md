# zaralX Assets

Minecraft assets API: item icons that look exactly like in an inventory slot, block textures,
languages, creative tabs and player skins — for every release since 1.21.4, updated automatically.

Documentation: https://zaralx.gitbook.io/assets · OpenAPI: `GET /swagger`

## How it works

Nothing is captured in game. A **pipeline** downloads the official `client.jar` of each version and
renders the icons itself, reproducing the game's GUI item rendering: item model definitions
(`assets/minecraft/items`), block and item models, display transforms, GUI lighting, tints and the
entity models behind chests, banners, beds, shulker boxes, heads, shields, pots and conduits.
The renderer is checked against 1396 in-game screenshots of 1.21.5 (`test/golden`).

```
Mojang version manifest ──► pipeline (worker) ──► DATA_DIR/versions/<id> ──► API
                             client.jar, asset index      icons, textures, lang, …
```

Per version the pipeline writes:

| Path                     | Content                                                        |
|--------------------------|----------------------------------------------------------------|
| `icons/<16…256>/<id>.webp` | icons rendered natively at every GUI scale                    |
| `textures/**`            | every vanilla texture with its `.mcmeta`                        |
| `items.json`             | items, translation keys, textures used by their models          |
| `blocks.json`            | blocks, texture of each side in the default state, all textures |
| `lang/`                  | `en_us` and the hashes of all other languages (fetched on use)  |
| `creative-tabs.json`     | creative tabs (hand-maintained in `resources/creative-tabs`)    |

## API

`{version}` is a version id, `latest` (newest release) or `latest-snapshot`.

| Route                                                | Description                                                  |
|------------------------------------------------------|--------------------------------------------------------------|
| `GET /v2/minecraft/versions`                         | built versions                                               |
| `GET /v2/minecraft/{version}`                        | build info, items without an icon                            |
| `GET /v2/minecraft/{version}/items?lang=&category=&q=` | items with names and icon links                            |
| `GET /v2/minecraft/{version}/items/{id}?lang=`       | item details and textures                                    |
| `GET /v2/minecraft/{version}/items/{id}/icon?size=&format=` | icon, `size` 16–1024, `format` `webp` or `png`        |
| `GET /v2/minecraft/{version}/blocks/{id}`            | block textures per side, separately from the icon            |
| `GET /v2/minecraft/{version}/textures?prefix=block/` | texture list                                                 |
| `GET /v2/minecraft/{version}/textures/block/stone.png?size=&frame=&strip=` | a texture; animated ones return one frame |
| `GET /v2/minecraft/{version}/lang/{code}`            | translations                                                 |
| `GET /v2/minecraft/{version}/creative-tabs`          | items per creative tab                                       |
| `GET /v2/minecraft/players/{name or uuid}`           | uuid and links                                               |
| `GET /v2/minecraft/players/{name or uuid}/skin`      | skin                                                         |
| `GET /v2/minecraft/players/{name or uuid}/face?size=&overlay=` | face                                               |

The v1 routes keep their paths and responses and serve `LEGACY_VERSION` (1.21.5).

## Development

Node 22+, pnpm.

```bash
pnpm install
pnpm pipeline build 26.3
pnpm dev
```

| Command                       | Result                                                      |
|-------------------------------|-------------------------------------------------------------|
| `pnpm dev`                    | API with reload                                             |
| `pnpm pipeline list`          | eligible versions and their state                           |
| `pnpm pipeline sync`          | build missing or outdated versions                          |
| `pnpm pipeline watch`         | `sync` every `PIPELINE_INTERVAL_MINUTES`                    |
| `pnpm pipeline build <id...>` | build specific versions                                     |
| `pnpm pipeline render <id> <item> --size 512` | render one icon to a png                    |
| `pnpm test`                   | unit tests                                                  |
| `pnpm test:golden`            | compare every icon with the 1.21.5 screenshots (downloads the jar) |
| `pnpm lint` / `pnpm typecheck` | checks                                                     |

Configuration is in [.env.example](.env.example). A change to the renderer or the output format
must bump `PIPELINE_VERSION` in `src/pipeline/build.ts`, so running workers rebuild existing versions.

## Deploy

`docker compose up -d` starts the API, the pipeline worker and Redis; API and worker share the
`assets_data` volume. On first start the worker builds every release since `PIPELINE_MIN_VERSION`
(about a minute each), newest last.

## Contributing

Contributions are welcome: fork the repo, create a branch, open a pull request.
