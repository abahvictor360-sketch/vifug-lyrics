// Cross-platform replacement for `rm -rf web-dist && cp -r ../web/dist web-dist`
// (the Windows CI runner has no usable `rm`/`cp`).
import { cpSync, rmSync } from "node:fs";

rmSync("web-dist", { recursive: true, force: true });
cpSync("../web/dist", "web-dist", { recursive: true });
console.log("Copied ../web/dist -> web-dist");
