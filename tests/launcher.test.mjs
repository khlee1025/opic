import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { terminateProcessTree } from "../local-launcher/server.mjs";

test("Windows scripts are UTF-8 with BOM for PowerShell 5.1 Korean text", async () => {
  for (const script of ["launch.ps1", "stop.ps1"]) {
    const bytes = await readFile(new URL(`../installer/${script}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], script);
  }
});

test("stop script validates the local service and terminates its process tree", async () => {
  const source = await readFile(new URL("../installer/stop.ps1", import.meta.url), "utf8");
  assert.match(source, /opic-daily-coach/);
  assert.match(source, /server\.pid/);
  assert.match(source, /taskkill(?:\.exe)?[\s\S]*\/T[\s\S]*\/F/i);
  assert.match(source, /Stop-Process\s+-Id\s+\$serverProcessId\s+-Force/i);
  assert.match(source, /Get-Process\s+-Id\s+\$serverProcessId/i);
});

test("Windows child cleanup uses taskkill for the full process tree", async () => {
  const calls = [];
  let directKills = 0;
  await terminateProcessTree({
    pid: 4321,
    exitCode: null,
    kill: () => {
      directKills += 1;
    },
  }, {
    platform: "win32",
    execFileImpl: (file, args, options, callback) => {
      calls.push({ file, args, options });
      callback(null, "", "");
    },
  });

  assert.equal(directKills, 0);
  assert.equal(calls.length, 1);
  assert.match(calls[0].file, /taskkill(?:\.exe)?$/i);
  assert.deepEqual(calls[0].args, ["/PID", "4321", "/T", "/F"]);
  assert.equal(calls[0].options.windowsHide, true);
});
