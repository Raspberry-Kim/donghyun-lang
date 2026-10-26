/*! 동현랭 (Donghyun-lang) runtime — 브라우저와 Node 양쪽에서 동작한다.
 *  <script src="donghyun.js"></script>
 *  <script type="text/donghyun" data-input="5" data-output="html"> ... </script>
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Donghyun = api;
  if (typeof document !== "undefined") {
    const boot = () => api.runScripts();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const START = "나는 동현이냐?", END = "동현이구나";
  const LIT = /도(오*)옹/y, INP = /꽥꽥/y, VAR = /(동+)현(?![아이])/y, ASSIGN = /^(동+)현아/;

  class DonghyunError extends Error {
    constructor(msg, line) { super(msg); this.line = line; this.name = "DonghyunError"; }
  }
  // 오겡끼데스까는 Error가 아니다: 일반 catch 분기로는 오류로 처리되지 않는다
  function Okengki(code) { this.code = code; }
  function EndSignal() {}

  function splitStatements(src) {
    const stmts = []; // {text, phys}
    src.replace(/\r/g, "").split("\n").forEach((raw, i) => {
      raw.split("~").forEach((part) => {
        stmts.push({ text: part.replace(/ㅋㅋ.*$/, "").trim(), phys: i + 1 });
      });
    });
    // 줄 번호는 '나는 동현이냐?' 줄을 1번으로 센다 (앞쪽 빈 줄은 무시) — HTML에 넣을 때 들여쓰기·빈 줄 걱정 없음
    while (stmts.length && stmts[0].text === "") stmts.shift();
    return stmts;
  }

  class VM {
    constructor(src, opts = {}) {
      this.vars = {};
      this.inputQueue = (opts.input || []).slice();
      this.readInt = opts.readInt || (() => this._readQueue());
      this.write = opts.write || ((s) => {});
      this.stmts = splitStatements(src);
      this.lines = this.stmts.map((s) => s.text);
      this.pc = 0; this.steps = 0; this.done = false; this.exitCode = null; this.halted = false;
      const body = this.lines.filter(Boolean);
      if (!body.length || body[0] !== START)
        throw new DonghyunError("첫 줄은 반드시 '나는 동현이냐?' 여야 한다. 넌 동현이가 아니다.", 1);
      if (body[body.length - 1] !== END)
        throw new DonghyunError("마지막 줄은 반드시 '동현이구나' 여야 한다.", this.lines.length);
      this.firstPhys = this.stmts[0].phys;
    }
    _readQueue() {
      if (!this.inputQueue.length) return 0;
      const raw = String(this.inputQueue.shift()).trim();
      if (!/^[-+]?\d+$/.test(raw)) throw new DonghyunError(`숫자를 달라고 했지 '${raw}'를 달라고 안 했다.`);
      return parseInt(raw, 10);
    }
    expr(s, pos = 0, stop = null) {
      // 붙여 쓴 원자는 더하고(항), 띄어 쓴 항은 곱한다. 뚱띠 = 다음 항으로 나눈 몫, 또치 = 다음 항으로 나눈 나머지.
      let prod = null, term = 0, seenTerm = false, seenAny = false, op = "*";
      const atom = (v, end) => { term += v; pos = end; seenTerm = seenAny = true; };
      const close = () => {
        if (!seenTerm) return;
        if (prod === null) { if (op !== "*") throw new DonghyunError(`${op === "/" ? "뚱띠" : "또치"} 앞에 나눌 수가 없다.`); prod = term; }
        else if (op === "*") prod *= term;
        else {
          if (term === 0) throw new DonghyunError(op === "/" ? "0으로 뚱띠하면 동현이도 운다." : "0으로 또치하면 동현이도 운다.");
          prod = op === "/" ? Math.trunc(prod / term) : prod % term;
          if (Object.is(prod, -0)) prod = 0;
        }
        if (!Number.isSafeInteger(prod)) throw new DonghyunError("수가 너무 커졌다. 동현이는 ±9007조까지만 센다.");
        term = 0; seenTerm = false; op = "*";
      };
      while (pos < s.length) {
        const c = s[pos];
        if (stop && c === stop) break;
        if (c === " ") { close(); pos++; continue; }
        if (s.startsWith("뚱띠", pos) || s.startsWith("또치", pos)) {
          close();
          if (prod === null) throw new DonghyunError(`${s.slice(pos, pos + 2)} 앞에 나눌 수가 없다.`);
          if (op !== "*") throw new DonghyunError("뚱띠·또치를 연달아 쓸 수 없다.");
          op = s.startsWith("뚱띠", pos) ? "/" : "%"; pos += 2; continue;
        }
        let m;
        INP.lastIndex = pos; if ((m = INP.exec(s))) { atom(this.readInt(), INP.lastIndex); continue; }
        LIT.lastIndex = pos; if ((m = LIT.exec(s))) { atom(m[1].length + 1, LIT.lastIndex); continue; }
        VAR.lastIndex = pos; if ((m = VAR.exec(s))) { atom(this.vars[m[1].length] || 0, VAR.lastIndex); continue; }
        if (c === "ㅠ") { atom(-1, pos + 1); continue; }
        throw new DonghyunError(`이건 동현이 말투가 아니다: '${s.slice(pos)}'`);
      }
      close();
      if (op !== "*") throw new DonghyunError("뚱띠·또치 뒤에 나눌 수가 없다.");
      return [seenAny ? prod : 0, pos];
    }
    ev(s) { return this.expr(s)[0]; }
    stmt(s, pc) {
      if (s === "" || s === START) return pc + 1;
      if (s === END) throw new EndSignal();
      if (s.startsWith("오겡끼데스까")) throw new Okengki(this.ev(s.slice(6).trim()));
      if (s.startsWith("신중동역")) return this.ev(s.slice(4).trim()) - 1;
      if (s.startsWith("신중동") || s.startsWith("뭉치")) {
        // 신중동: 값이 0이면 실행, 뭉치: 값이 음수이면 실행
        const kw = s.startsWith("뭉치") ? "뭉치" : "신중동";
        const rest = s.slice(kw.length).trimStart();
        const [v, p] = this.expr(rest, 0, "?");
        if (p >= rest.length || rest[p] !== "?") throw new DonghyunError(`${kw} 뒤에는 '?'로 끝나는 조건이 필요하다.`);
        const ok = kw === "뭉치" ? v < 0 : v === 0;
        return ok ? this.stmt(rest.slice(p + 1).trim(), pc) : pc + 1;
      }
      if (s.startsWith("포동이")) {
        // 고정소수점 출력: 값을 1000으로 나눠 소수 셋째 자리까지 (1234 → 1.234)
        const v = this.ev(s.slice(3).trim()), a = Math.abs(v);
        this.write(`${v < 0 ? "-" : ""}${Math.trunc(a / 1000)}.${String(a % 1000).padStart(3, "0")}`);
        return pc + 1;
      }
      if (s.startsWith("뿡뿡뿡")) {
        const e = s.slice(3).trim();
        if (!e) this.write("\n");
        else {
          const cp = this.ev(e);
          if (cp < 0 || cp > 0x10ffff) throw new DonghyunError(`${cp}는 문자로 뀔 수 없다.`);
          this.write(String.fromCodePoint(cp));
        }
        return pc + 1;
      }
      if (s.startsWith("뿡뿡")) { this.write(String(this.ev(s.slice(2).trim()))); return pc + 1; }
      const m = s.match(ASSIGN);
      if (m) { this.vars[m[1].length] = this.ev(s.slice(m[0].length).trim()); return pc + 1; }
      throw new DonghyunError(`동현이는 그런 말 안 한다: '${s}'`);
    }
    /** 최대 budget개의 문장을 실행한다. 끝나면 true. */
    step(budget = 1) {
      if (this.done) return true;
      try {
        for (let i = 0; i < budget; i++) {
          if (this.pc < 0 || this.pc >= this.lines.length) { this._finish(0); return true; }
          const cur = this.pc;
          try { this.pc = this.stmt(this.lines[cur], cur); }
          catch (e) { if (e instanceof DonghyunError && e.line == null) e.line = cur + 1; throw e; }
          this.steps++;
        }
        return false;
      } catch (e) {
        if (e instanceof EndSignal) { this._finish(0); return true; }
        if (e instanceof Okengki) { this.halted = true; this._finish(e.code); return true; }
        this.done = true; throw e;
      }
    }
    _finish(code) { this.done = true; this.exitCode = code; }
    get currentLine() { return this.pc + 1; }
    run(maxSteps = 1e7) {
      if (!this.step(maxSteps)) throw new DonghyunError(`${maxSteps}번을 돌아도 안 끝난다. 오겡끼데스까를 외쳐라.`);
      return this.exitCode;
    }
  }

  function run(src, opts = {}) {
    let out = "";
    const vm = new VM(src, { ...opts, write: (s) => { out += s; opts.write && opts.write(s); } });
    const code = vm.run(opts.maxSteps);
    return { output: out, exitCode: code, halted: vm.halted, steps: vm.steps };
  }

  // ---- 문자열 → 동현랭 코드 생성기 ----
  const lit = (n) => "도" + "오".repeat(n - 1) + "옹";
  function encodeChar(c, out) {
    if (c <= 12) { out.push(`뿡뿡뿡 ${lit(c)}`); return; }
    let best = null;
    for (let a = 2; a <= 12; a++) if (c % a === 0 && c / a <= 12) {
      const cand = `${lit(a)} ${lit(c / a)}`;
      if (!best || cand.length < best.length) best = cand;
    }
    if (best) { out.push(`뿡뿡뿡 ${best}`); return; }
    const ds = String(c).split("").map(Number);
    out.push(`동현아 ${lit(ds[0])}`);
    for (const d of ds.slice(1)) {
      out.push(`동현아 동현 ${lit(10)}`);
      if (d) out.push(`동현아 동현${lit(d)}`);
    }
    out.push("뿡뿡뿡 동현");
  }
  function encode(text, { newline = true } = {}) {
    const out = [START];
    for (const ch of text) {
      if (ch === "\n") out.push("뿡뿡뿡");
      else encodeChar(ch.codePointAt(0), out);
    }
    if (newline) out.push("뿡뿡뿡");
    out.push(END);
    return out.join("\n");
  }

  // ---- <script type="text/donghyun"> 자동 실행 ----
  function runScripts(scope) {
    if (typeof document === "undefined") return;
    (scope || document).querySelectorAll('script[type="text/donghyun"]:not([data-ran])').forEach((el) => {
      el.setAttribute("data-ran", "");
      const input = (el.getAttribute("data-input") || "").split(/[\s,]+/).filter(Boolean);
      const mode = el.getAttribute("data-output") || "text";
      const targetSel = el.getAttribute("data-target");
      let target = targetSel && document.querySelector(targetSel);
      if (!target) {
        target = document.createElement(mode === "html" ? "div" : "pre");
        target.className = "donghyun-output";
        el.after(target);
      }
      try {
        const r = run(el.textContent, { input });
        if (mode === "html") target.innerHTML = r.output;
        else target.textContent = r.output;
        target.dispatchEvent(new CustomEvent("donghyun:done", { detail: r, bubbles: true }));
      } catch (e) {
        target.textContent = `[동현이 아님${e.line ? ` · ${e.line}번 줄` : ""}] ${e.message}`;
        target.classList.add("donghyun-error");
      }
    });
  }

  return { VM, run, encode, runScripts, DonghyunError, START, END, version: "1.53.0" };
});
