# Verification and capture operations

## Development feedback and final gates

For one game's presentation, start with `npm run preview -- <slug>` and the relevant tests under `scripts/gallery/` or the game's directory. Use `npm run dev` when the entire catalog is needed. Keep dependencies and builds on Linux ext4; WSL checkouts under `/mnt/*` are unsuitable for build/upload work.

Before handing off the final source, run from the root:

```sh
npm run build
npm run typecheck
npm run check
npm test
```

Build first because the workspaces import compiled outputs. The remaining checks may overlap if enough memory is available, but collect every exit status. Add `npm run test:browser` and relevant live/replay/small-screen checks for browser changes. A targeted pass is feedback, not a substitute for the final required gates. Reuse successful evidence only for the exact current commit and covered checks; do not rerun the entire suite after a read-only inspection, or reuse an earlier commit's result after editing.

Game Lab's public pull-request workflow remains on GitHub-hosted runners. The always-on `crashwif-ci` pool and the platform's branch-check CLI serve the private platform repository; they are not a general public-PR executor. Do not route fork code there or expose its Docker socket, writable trusted caches or deployment credentials. A future Game Lab remote entrypoint must explicitly restrict trusted refs and resolve a branch to an exact SHA before creating an isolated workspace. It should fetch into its resident clone, report that SHA and preserve separate workspaces for concurrent jobs. No such Game Lab entrypoint is enabled by this change.

## Capture runtime and cache

Gallery posters run with two independent browser pages by default. `GAME_LAB_CAPTURE_CONCURRENCY` accepts integers 1–8; use 1 on a constrained machine and increase only after checking CPU, memory and representative WebGL captures. Every page still plays for its configured `poster.seconds`. Workers finish before the browser closes; errors remain in catalog order and failed pages produce no poster.

CI plan and export use `scripts/gallery/run-capture.mjs`. It verifies the configured GHCR digest, the image's recipe hash against the committed Dockerfile, architecture and Node/Playwright versions. The image also contains a runtime receipt that the capture loader checks. The capture process has no external network, a read-only root, dropped capabilities and no host Docker socket or registry token. Its source/output checkout is writable, and a linked worktree's shared Git metadata is mounted read-only.

The image freezes the installed Chromium, Microsoft core fonts, fontconfig and system libraries. Every export still computes their actual hashes and font selection; an image label alone never establishes poster equivalence. The source recipe and rendered bundle bytes also participate in the poster key. Corrupt files, changed capture inputs or missing provenance cause recapture. Do not remove inputs from the fingerprint just to obtain a cache hit.

The immutable runtime has Playwright installed before `npm ci`, so planning can verify cached posters immediately. If all bundles and posters match, CI skips dependency installation and building. Without a usable local capture runtime, direct `export.mjs --plan` remains conservative; an actual cached export fails if the runtime cannot be verified. The `capture-environment` artifact contains the metadata and per-file hashes behind the fingerprint, making unexpected invalidation inspectable.

## Capture image operations

The recipe pins both base images by digest. Microsoft fonts and browser tooling are installed at image build time; unavailable fonts fail the build. Runtime jobs never run `apt-get` or download a browser. Rebuilding the recipe can resolve newer OS packages, so publish a new immutable digest and verify it before changing the configured pin.

For the first rollout:

1. Merge the image recipe and workflow.
2. Run **Build gallery capture image** on `main`. Its summary reports `ghcr.io/crashwif/game-lab-capture@sha256:<digest>`.
3. Ensure the package grants the `Crashwif/game-lab` repository Actions read access. The export job uses its repository-scoped read token; it has no package write or platform permissions.
4. Verify the image and capture representative Canvas 2D and WebGL games, then set repository variable `GAME_LAB_CAPTURE_IMAGE` to the exact digest reference.
5. Rerun **Deploy Game Lab**. Until the variable is set, publishing reports that setup is required and performs no export or publication. Invalid configured pins fail instead of using a mutable fallback.

Build a candidate locally without publishing it:

```sh
capture_recipe=$(node scripts/gallery/capture-image.mjs)
docker build --platform linux/amd64 \
  --build-arg CAPTURE_RECIPE_SHA="$capture_recipe" \
  -f scripts/gallery/capture.Dockerfile \
  -t "game-lab-capture:recipe-$capture_recipe" .
```

After a candidate is published and approved, use its exact digest from a clean checkout:

```sh
export GAME_LAB_CAPTURE_IMAGE='ghcr.io/crashwif/game-lab-capture@sha256:<digest>'
node scripts/gallery/run-capture.mjs --verify
node scripts/gallery/run-capture.mjs --smoke
node scripts/gallery/run-capture.mjs --commit HEAD --cache .game-lab-cache --plan
node scripts/gallery/run-capture.mjs --commit HEAD --cache .game-lab-cache --dist dist --out gallery-out
```

Install dependencies and build shared packages on the host before `--smoke`, or when the plan reports missing bundles. The smoke check captures Hello World and Seed Round in real Chromium, verifies a warm plan and export perform zero builds/captures, and compares reused PNG hashes. It prints an artifact directory under `gallery-out/` for visual inspection. Set `GAME_LAB_CAPTURE_MANIFEST` to an absolute output path to retain a local input manifest. A complete first export populates the cache; the next unchanged export should report zero builds and captures. Compare manifest `files`, `metadata.fontMatch` and recipe source when that expectation fails. Preserve the unchanged-bundle poster hashes during this check.

For changes to the runtime or scheduler, run:

```sh
node --test scripts/gallery/capture*.test.mjs scripts/gallery/export.test.mjs
```

Also perform a real Chromium smoke capture. Unit scheduler tests do not measure rendering performance. For example, compare the same Seed Round, Blanket Champ, Moon Boys and Hello World timings with one and two workers, check browser errors and nonblank PNGs, and inspect the WebGL posters. Keep these observations separate from a claimed whole-catalog speedup.

Changing Node or Playwright requires keeping the Dockerfile, `.nvmrc` and package version consistent, publishing the new recipe, and updating the digest pin. Older source commits with a different Playwright version need a compatible verified recipe; a mismatched runtime is rejected. Registry write permission belongs only to the main-branch image builder. The platform deploy token remains confined to the separate publish job.
