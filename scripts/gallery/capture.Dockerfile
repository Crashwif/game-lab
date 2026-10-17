# This recipe is hashed and checked before a published image can run an export.
# Rebuild and publish it, then pin the returned digest in GAME_LAB_CAPTURE_IMAGE.
FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS node
FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

ENV LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=Etc/UTC \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    GAME_LAB_CAPTURE_PACKAGE_ROOT=/opt/game-lab-capture

# Fonts are installed when the image is built, never during a capture job.
# Preserve the existing Microsoft core-font recipe; an unavailable font fails the build.
RUN sed -i '/^Components:/ { /multiverse/! s/$/ multiverse/; }' /etc/apt/sources.list.d/ubuntu.sources \
 && echo 'ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true' | debconf-set-selections \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ttf-mscorefonts-installer fontconfig git ca-certificates \
 && fc-cache -f \
 && test "$(fc-match --format '%{family}' Arial)" = Arial \
 && rm -rf /var/lib/apt/lists/*

RUN npm install --prefix /opt/game-lab-capture --ignore-scripts --no-audit --no-fund --save-exact playwright@1.63.0 \
 && node -e "const fs=require('fs'); const p=require('/opt/game-lab-capture/node_modules/playwright'); if(!fs.existsSync(p.chromium.executablePath())) throw Error('Pinned Chromium is missing')"

ARG CAPTURE_RECIPE_SHA
RUN node -e "const fs=require('fs');const recipe=process.env.CAPTURE_RECIPE_SHA;if(!/^[a-f0-9]{64}$/.test(recipe))throw Error('Capture recipe hash required');fs.writeFileSync('/opt/game-lab-capture/runtime.json',JSON.stringify({recipe,node:process.version,playwright:require('/opt/game-lab-capture/node_modules/playwright/package.json').version})+'\n')"
LABEL io.crashwif.game-lab.capture.recipe=$CAPTURE_RECIPE_SHA \
      io.crashwif.game-lab.capture.node="24.21.0" \
      io.crashwif.game-lab.capture.playwright="1.63.0"
WORKDIR /work
USER pwuser
