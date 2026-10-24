#!/usr/bin/env python3
"""동현랭 (Donghyun-lang) v1.52 인터프리터  —  나는 동현이냐? ... 동현이구나"""
import re, sys

START, END = "나는 동현이냐?", "동현이구나"

class 동현Error(Exception): pass
class 오겡끼데스까(BaseException):          # Exception이 아니라 BaseException: 어떤 except로도 못 잡는다
    def __init__(self, code): self.code = code

LIT = re.compile(r"도(오*)옹")
INP = re.compile(r"꽥꽥")
VAR = re.compile(r"(동+)현(?![아이])")

class VM:
    def __init__(self, src, stdin=sys.stdin, out=sys.stdout):
        self.vars, self.stdin, self.out, self._tokens = {}, stdin, out, None
        lines = []
        for raw in src.replace("\r", "").split("\n"):
            lines.extend(raw.split("~"))
        self.lines = [re.sub(r"ㅋㅋ.*$", "", l).strip() for l in lines]
        while self.lines and self.lines[0] == "":   # 줄 번호는 '나는 동현이냐?' 줄을 1번으로 센다
            self.lines.pop(0)
        body = [l for l in self.lines if l]
        if not body or body[0] != START:
            raise 동현Error("첫 줄은 반드시 '나는 동현이냐?' 여야 한다. 넌 동현이가 아니다.")
        if body[-1] != END:
            raise 동현Error("마지막 줄은 반드시 '동현이구나' 여야 한다.")

    # ---------- 식 ----------
    def expr(self, s, pos=0, stop=None):
        """붙여 쓴 원자는 더하고(항), 띄어 쓴 항은 곱한다. 뚱띠 = 몫, 또치 = 나머지 (C처럼 0 쪽으로 버림)."""
        st = {"prod": None, "term": 0, "seen_term": False, "op": "*"}
        seen_any = False
        def close():
            if not st["seen_term"]: return
            t, op = st["term"], st["op"]
            if st["prod"] is None:
                if op != "*": raise 동현Error("뚱띠·또치 앞에 나눌 수가 없다.")
                st["prod"] = t
            elif op == "*": st["prod"] *= t
            else:
                if t == 0: raise 동현Error(("0으로 뚱띠하면" if op == "/" else "0으로 또치하면") + " 동현이도 운다.")
                a, q = st["prod"], int(st["prod"] / t) if abs(st["prod"]) < 2**52 else abs(st["prod"]) // abs(t) * (1 if (st["prod"] >= 0) == (t > 0) else -1)
                st["prod"] = q if op == "/" else a - q * t
            if abs(st["prod"]) > 2**53 - 1: raise 동현Error("수가 너무 커졌다. 동현이는 ±9007조까지만 센다.")
            st["term"], st["seen_term"], st["op"] = 0, False, "*"
        n = len(s)
        while pos < n:
            c = s[pos]
            if stop and c == stop: break
            if c == " ": close(); pos += 1; continue
            if s.startswith("뚱띠", pos) or s.startswith("또치", pos):
                close()
                if st["prod"] is None: raise 동현Error(f"{s[pos:pos+2]} 앞에 나눌 수가 없다.")
                if st["op"] != "*": raise 동현Error("뚱띠·또치를 연달아 쓸 수 없다.")
                st["op"] = "/" if s.startswith("뚱띠", pos) else "%"; pos += 2; continue
            for rx, val in ((INP, None), (LIT, None), (VAR, None)):
                m = rx.match(s, pos)
                if m:
                    if rx is INP: v = self.read_int()
                    elif rx is LIT: v = len(m.group(1)) + 1
                    else: v = self.vars.get(len(m.group(1)), 0)
                    st["term"] += v; pos = m.end(); st["seen_term"] = seen_any = True
                    break
            else:
                if c == "ㅠ":
                    st["term"] -= 1; pos += 1; st["seen_term"] = seen_any = True; continue
                raise 동현Error(f"이건 동현이 말투가 아니다: '{s[pos:]}'")
        close()
        if st["op"] != "*": raise 동현Error("뚱띠·또치 뒤에 나눌 수가 없다.")
        return (st["prod"] if seen_any else 0), pos

    def ev(self, s):
        v, p = self.expr(s)
        return v

    def read_int(self):
        # 입력은 공백·줄바꿈으로 구분한 정수들. 다 쓰면 0 (웹판과 같다)
        if self._tokens is None: self._tokens = self.stdin.read().split()
        if not self._tokens: return 0
        tok = self._tokens.pop(0)
        if not re.fullmatch(r"[-+]?\d+", tok): raise 동현Error(f"숫자를 달라고 했지 '{tok}'를 달라고 안 했다.")
        return int(tok)

    # ---------- 문장 ----------
    def stmt(self, s, pc):
        """실행 후 다음 pc를 돌려준다."""
        if s == "" or s == START: return pc + 1
        if s == END: raise _End()
        if s.startswith("오겡끼데스까"):
            raise 오겡끼데스까(self.ev(s[len("오겡끼데스까"):].strip()))
        if s.startswith("신중동역"):
            return self.ev(s[len("신중동역"):].strip()) - 1          # 1-based 줄 번호
        if s.startswith("신중동") or s.startswith("뭉치"):
            kw = "뭉치" if s.startswith("뭉치") else "신중동"      # 신중동: 0이면, 뭉치: 음수이면
            rest = s[len(kw):].lstrip()
            v, p = self.expr(rest, 0, stop="?")
            if p >= len(rest) or rest[p] != "?":
                raise 동현Error(f"{kw} 뒤에는 '?'로 끝나는 조건이 필요하다.")
            ok = v < 0 if kw == "뭉치" else v == 0
            return self.stmt(rest[p+1:].strip(), pc) if ok else pc + 1
        if s.startswith("포동이"):                                   # 고정소수점 출력: 1234 → 1.234
            v = self.ev(s[3:].strip()); a = abs(v)
            self.out.write(f"{'-' if v < 0 else ''}{a // 1000}.{a % 1000:03d}"); return pc + 1
        if s.startswith("뿡뿡뿡"):
            e = s[3:].strip()
            self.out.write(chr(self.ev(e)) if e else "\n"); return pc + 1
        if s.startswith("뿡뿡"):
            self.out.write(str(self.ev(s[2:].strip()))); return pc + 1
        m = re.match(r"(동+)현아", s)
        if m:
            self.vars[len(m.group(1))] = self.ev(s[m.end():].strip()); return pc + 1
        raise 동현Error(f"동현이는 그런 말 안 한다: '{s}'")

    def run(self):
        pc = 0
        try:
            while 0 <= pc < len(self.lines):
                pc = self.stmt(self.lines[pc], pc)
            return 0
        except _End:
            return 0
        except 오겡끼데스까 as e:
            self.out.flush()
            sys.stderr.write("\n…와타시와 겡끼데스.\n")
            return e.code

class _End(Exception): pass

def main():
    if len(sys.argv) < 2:
        print("사용법: python3 donghyun.py 파일.dh"); sys.exit(2)
    src = open(sys.argv[1], encoding="utf-8").read()
    try:
        code = VM(src).run()
    except 동현Error as e:
        sys.stdout.flush(); sys.stderr.write(f"\n[동현이 아님] {e}\n"); sys.exit(1)
    sys.stdout.flush(); sys.exit(code if isinstance(code, int) else 0)

if __name__ == "__main__":
    main()
