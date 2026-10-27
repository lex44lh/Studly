"""Read-only scope, manifest, preservation and credential-pattern gates; never stages or commits."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import subprocess

ROOT = Path(__file__).resolve().parents[7]
OUT = Path(__file__).resolve().parent
BASE = "abe0efb2648ab34f19b9c23f3cf4427bd76e6e05"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


manifest_path = OUT / "source-manifest.json"
manifest = json.loads(manifest_path.read_text())
issues = []
for item in manifest["files"]:
    path = ROOT / item["path"]
    mode = "120000" if path.is_symlink() else "100755" if path.stat().st_mode & 0o111 else "100644"
    data = os.readlink(path).encode() if path.is_symlink() else path.read_bytes()
    if hashlib.sha256(data).hexdigest() != item["sha256"] or mode != item["mode"]:
        issues.append({"manifestMismatch": item["path"]})
    if git("show", "HEAD:" + item["path"]) != data:
        issues.append({"sourceNotCommittedAtHead": item["path"]})

changed = set(git("diff", "--name-only", "-z", BASE).decode().split("\0"))
changed |= set(git("ls-files", "--others", "--exclude-standard", "-z").decode().split("\0"))
changed.discard("")
allowed_docs = "documents/project/для отчетов/frontend/api-integration/"
for name in sorted(changed):
    if not (name.startswith("apps/web/src/") or name.startswith("apps/web/tests/") or
            name == "documents/project/для отчетов/README.md" or
            name.startswith(allowed_docs + "2026-10-27_12-33_") or
            name.startswith(allowed_docs + "implementation/2026-10-27-corrections/")):
        issues.append({"unexpectedPath": name})
    if re.search(r"(^|/)(?:\.env(?:\..*)?|node_modules|\.next|apps/api)(?:/|$)|studly-logo-files\.zip$", name):
        issues.append({"forbiddenPath": name})

# Scan changed text only; results never include matched credential contents.
patterns = [r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", r"\bgh[pousr]_[A-Za-z0-9]{30,}\b",
            r"\bgithub_pat_[A-Za-z0-9_]{40,}\b", r"\bAKIA[0-9A-Z]{16}\b",
            r"\b[0-9]{8,12}:[A-Za-z0-9_-]{35}\b", r"\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b"]
scanned = 0
for name in sorted(changed):
    path = ROOT / name
    if not path.is_file() or path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
        continue
    text = path.read_text(errors="replace"); scanned += 1
    for line_number, line in enumerate(text.splitlines(), 1):
        if any(re.search(pattern, line) for pattern in patterns):
            issues.append({"credentialPattern": name, "line": line_number})

old_reports = [name for name in git("ls-tree", "-r", "--name-only", "-z", BASE, "documents/project/для отчетов/").decode().split("\0")
               if name and name != "documents/project/для отчетов/README.md"]
for name in old_reports:
    path = ROOT / name
    if not path.is_file() or path.read_bytes() != git("show", f"{BASE}:{name}"):
        issues.append({"historicalReportChanged": name})
accepted = ROOT / "documents/project/для отчетов/frontend/redesign/2026-10-23_17-12_f123-candidate.manifest.json"
accepted_sha = digest(accepted)
if accepted_sha != "ef7afc71711a6341238c0cab3e99ccbe4ebe2187012e8f516532cfb204022e65":
    issues.append({"acceptedManifestChanged": True})
checks = {}
for args in [("diff", "--check"), ("diff", "--cached", "--check")]:
    value = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    checks[" ".join(args)] = {"exit_code": value.returncode, "output": value.stdout + value.stderr}
    if value.returncode:
        issues.append({"diffCheckFailed": list(args)})
summary_path = OUT / "verification-summary.json"
evidence_count = 0
if summary_path.exists():
    summary = json.loads(summary_path.read_text())
    for item in summary["evidenceFiles"]:
        if digest(OUT / item["path"]) != item["sha256"]:
            issues.append({"evidenceHashMismatch": item["path"]})
        evidence_count += 1
    for item in summary["reportFiles"]:
        if digest(ROOT / item["path"]) != item["sha256"]:
            issues.append({"reportHashMismatch": item["path"]})
    for item in summary["requiredCommandResults"]:
        if json.loads((OUT / item).read_text())["exit_code"] != 0:
            issues.append({"requiredCommandFailed": item})
value = {"checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "base": BASE,
         "head": git("rev-parse", "HEAD").decode().strip(), "branch": git("branch", "--show-current").decode().strip(),
         "sourceManifestSHA256": digest(manifest_path), "sourceFiles": len(manifest["files"]),
         "sourceComparedWithGitHead": True,
         "evidenceHashesVerified": evidence_count,
         "acceptedManifestSHA256": accepted_sha, "historicalReportsPreserved": len(old_reports),
         "newTextFilesScanned": scanned, "credentialScan": "Known credential patterns plus manual diff review; not a proof of absence of every possible secret",
         "checks": checks, "changedPaths": sorted(changed),
         "stagedPaths": git("diff", "--cached", "--name-only", "-z").decode().split("\0")[:-1],
         "issues": issues, "pass": not issues}
(OUT / "publication-gate.json").write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"pass": not issues, "issues": issues, "sourceFiles": len(manifest["files"]), "historicalReportsPreserved": len(old_reports), "changedPaths": len(changed)}, ensure_ascii=False))
raise SystemExit(bool(issues))
