# zaralX Assets

API with Minecraft item icons, block textures, languages, creative tabs and player skins.
Supports every release since 1.21.4, new releases are added automatically.

Documentation: https://zaralx.gitbook.io/assets, OpenAPI: `GET /swagger`

## How it works

The pipeline downloads `client.jar` of each version and renders icons from it: item definitions,
block and item models, GUI transforms and lighting, tints, and the entity models of chests, banners,
beds, shulker boxes, heads, shields, pots and conduits. The result is compared with 1396 in-game
screenshots of 1.21.5 in `test/golden`.

Per version, `DATA_DIR/versions/<id>` contains:

| Path                       | Content                                                |
|----------------------------|--------------------------------------------------------|
| `icons/<16..256>/<id>.webp` | icons rendered at every GUI scale                     |
| `textures/**`              | vanilla textures with their `.mcmeta`                  |
| `items.json`               | items, translation keys, textures of their models      |
| `blocks.json`              | blocks, texture of each side, all textures of all states |
| `lang/`                    | `en_us` and hashes of the other languages, downloaded on first use |
| `creative-tabs.json`       | creative tabs from `resources/creative-tabs`           |

## API

`{version}` is a version id, `latest` (newest release) or `latest-snapshot`.

| Route                                                 | Description                                     |
|-------------------------------------------------------|-------------------------------------------------|
| `GET /v2/minecraft/versions`                          | built versions                                  |
| `GET /v2/minecraft/{version}`                         | build info, items without an icon               |
| `GET /v2/minecraft/{version}/items?lang=&category=&q=` | items with names and icon links                |
| `GET /v2/minecraft/{version}/items/{id}?lang=`        | item details and textures                       |
| `GET /v2/minecraft/{version}/items/{id}/icon?size=&format=` | icon, `size` 16 to 1024, `format` `webp` or `png` |
| `GET /v2/minecraft/{version}/blocks/{id}`             | block textures per side                         |
| `GET /v2/minecraft/{version}/textures?prefix=block/`  | texture list                                    |
| `GET /v2/minecraft/{version}/textures/block/stone.png?size=&frame=&strip=` | texture, animated ones return one frame by default |
| `GET /v2/minecraft/{version}/lang/{code}`             | translations                                    |
| `GET /v2/minecraft/{version}/creative-tabs`           | items per creative tab                          |
| `GET /v2/minecraft/players/{name or uuid}`            | uuid and links                                  |
| `GET /v2/minecraft/players/{name or uuid}/skin`       | skin                                            |
| `GET /v2/minecraft/players/{name or uuid}/face?size=&overlay=` | face                                   |

v1 routes keep their paths and responses and use `LEGACY_VERSION` (1.21.5).

## Development

Node 22+, pnpm.

```bash
pnpm install
pnpm pipeline build 26.3
pnpm dev
```

| Command                        | Result                                          |
|--------------------------------|-------------------------------------------------|
| `pnpm dev`                     | API with reload                                 |
| `pnpm pipeline list`           | versions and their state                        |
| `pnpm pipeline sync`           | build missing or outdated versions              |
| `pnpm pipeline watch`          | `sync` every `PIPELINE_INTERVAL_MINUTES`        |
| `pnpm pipeline build <id...>`  | build given versions                            |
| `pnpm pipeline render <id> <item> --size 512` | render one icon to png           |
| `pnpm test`                    | unit tests                                      |
| `pnpm test:golden`             | compare icons with the 1.21.5 screenshots       |
| `pnpm lint`, `pnpm typecheck`  | checks                                          |

Settings are in [.env.example](.env.example). After changing the renderer or the output format,
bump `PIPELINE_VERSION` in `src/pipeline/build.ts` so workers rebuild existing versions.

## Deploy

`docker compose up -d` starts the API, the pipeline worker and Redis. API and worker share the
`assets_data` volume. On first start the worker builds all releases since `PIPELINE_MIN_VERSION`,
about a minute each.

## Contributing

Fork the repo, create a branch and open a pull request.
