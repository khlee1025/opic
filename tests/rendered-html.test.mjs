import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function render() {
  const entry = fileURLToPath(new URL("../dist/standalone/server.js", import.meta.url));
  await access(entry);
  const port = await freePort();
  const child = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: "ignore",
    windowsHide: true,
  });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { accept: "text/html" },
      });
      return { response, close: () => child.kill() };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  child.kill();
  throw new Error("standalone server did not become ready");
}

test("server-renders the private OPIc Daily Coach shell", async (t) => {
  const { response, close } = await render();
  t.after(close);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="ko"/i);
  assert.match(html, /<title>OPIc Daily Coach<\/title>/i);
  assert.match(html, /loading-pane/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("starter preview is fully removed and the learning flow is present", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /한국어로 생각 정리하기/);
  assert.match(page, /aria-label="연습 질문"/);
  assert.match(page, /> 이전 단계</);
  assert.match(page, /getPreviousPracticeStage/);
  assert.match(page, /재작성 제출하고 해설 보기/);
  assert.match(page, /답안 가리고 시작/);
  assert.match(page, /\/api\/coach/);
  assert.match(page, /getQuestionPairForDate/);
  assert.match(layout, /title:\s*"OPIc Daily Coach"/);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
