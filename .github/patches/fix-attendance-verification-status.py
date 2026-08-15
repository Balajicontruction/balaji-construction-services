from pathlib import Path

p = Path('dashboard.html')
s = p.read_text(encoding='utf-8')
old = "verification_status:'approved',verification_method:'face_recognition'"
new = "verification_status:'verified',verification_method:'face_recognition'"
if old in s:
    s = s.replace(old, new)
old2 = "verification_status:'rejected',updated_at"
new2 = "verification_status:'failed',updated_at"
if old2 in s:
    s = s.replace(old2, new2)
p.write_text(s, encoding='utf-8')
print('attendance verification status values fixed')
