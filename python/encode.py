#!/usr/bin/env python3
"""문자열을 출력하는 동현랭 프로그램을 생성한다.  python3 encode.py "Hello, World!" """
import sys, math
def lit(n):  # 1 이상
    return "도" + "오"*(n-1) + "옹"
def num(n):
    """n을 '항 항' 꼴(곱)로 표현. 각 항은 리터럴 합."""
    if n <= 0: return lit(1) + "ㅠ"*(1-n) if n < 0 else lit(1)+"ㅠ"
    if n <= 12: return lit(n)
    best = None
    for a in range(2, 13):
        b, r = divmod(n, a)
        if b < 1: continue
        # (a) * (b + r/a)는 정수가 아니므로: n = a*b + r → a항 × b항 은 곱만 되므로 r은 따로 처리 불가.
        if r == 0 and b <= 12:
            cand = f"{lit(a)} {lit(b)}"
            if best is None or len(cand) < len(best): best = cand
    return best
def program(text):
    out = ["나는 동현이냐?"]
    for ch in text:
        c = ord(ch)
        e = num(c)
        if e:
            out.append(f"뿡뿡뿡 {e}")
        else:  # 곱으로 안 떨어지면 동현이에게 10진수로 한 자리씩 쌓는다 (호너 방식)
            ds = [int(d) for d in str(c)]
            out.append(f"동현아 {lit(ds[0])}")
            for d in ds[1:]:
                out.append(f"동현아 동현 {lit(10)}")
                if d: out.append(f"동현아 동현{lit(d)}")
            out.append("뿡뿡뿡 동현")
    out.append("뿡뿡뿡")
    out.append("동현이구나")
    return "\n".join(out)
if __name__ == "__main__":
    print(program(sys.argv[1] if len(sys.argv) > 1 else "Hello, World!"))
