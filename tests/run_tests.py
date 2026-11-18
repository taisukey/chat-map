"""Static checks for the bundled chat-map templates and CM_DATA files."""

import argparse
from datetime import date
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures"
TEMPLATES = {
    "v1": "chat-map-template.html",
    "v2": "chat-map-template-v2.html",
    "v2.1": "chat-map-template-v21.html",
}
CONTROLS = {
    "v2": ("cmxVGraph", "cmxVCards", "cmxTStd", "cmxTDark"),
    "v2.1": ("cmxVGraph", "cmxVCards", "cmxVTree", "cmxTStd", "cmxTDark", "cmxTMono"),
}


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.buttons = []
        self.ids = []
        self.targets = []
        self.scripts = []
        self.in_script = False
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "button":
            self.buttons.append(attrs.get("id"))
        if tag in ("a", "img"):
            self.targets.append(attrs.get("href" if tag == "a" else "src"))
        if tag == "script":
            self.in_script = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_script = False

    def handle_data(self, data):
        if self.in_script:
            self.scripts.append(data)


# Keep strings and comments whole so their braces and assignment-like text
# cannot affect the literal boundary or the definition count.
JS_TOKEN = re.compile(
    r"""(?P<skip>\s+|//[^\n]*|/\*[\s\S]*?\*/)"""
    r"""|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`"""
    r"""|[A-Za-z_$][\w$]*|-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?"""
    r"""|===|==|=>|[^\s]"""
)
IDENTIFIER = re.compile(r"[A-Za-z_$][\w$]*")


def assignments(markup, name):
    prefix = name.replace(".", " . ").split()
    pattern = prefix + ["="]
    for script in markup.scripts:
        tokens = [match[0] for match in JS_TOKEN.finditer(script) if not match["skip"]]
        for index, token in enumerate(tokens):
            if token != prefix[0] or (index and tokens[index - 1] == "."):
                continue
            end = index + len(pattern)
            if tokens[index:end] == pattern:
                yield tokens, end


def read_literal(tokens, start):
    require(tokens[start:start + 1] == ["{"], "expected an object literal")
    closing = []
    json_tokens = []
    # The templates use JSON values with bare JS keys. Normalize those keys
    # and trailing commas, then let the JSON decoder validate the structure.
    for index in range(start, len(tokens)):
        token = tokens[index]
        next_token = tokens[index + 1:index + 2]
        if token in ("{", "["):
            closing.append("}" if token == "{" else "]")
        elif token in ("}", "]"):
            require(closing and closing.pop() == token, "unbalanced object literal")
        if token == "," and next_token == closing[-1:]:
            continue
        if next_token == [":"] and IDENTIFIER.fullmatch(token):
            token = json.dumps(token)
        json_tokens.append(token)
        if not closing:
            return json.loads(" ".join(json_tokens))
    raise ValueError("unterminated object literal")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(data, clusters, edge_types):
    """Raise ValueError with a rule name and location for invalid CM_DATA."""
    require(isinstance(data, dict), "shape: expected a CM_DATA object")
    for key in ("dates", "nodes", "edges", "events"):
        require(isinstance(data.get(key), list), f"shape: {key} must be an array")

    previous = None
    for index, value in enumerate(data["dates"]):
        location = f"dates[{index}]"
        require(isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value),
                f"invalid_date: {location} must use YYYY-MM-DD")
        try:
            current = date.fromisoformat(value)
        except ValueError as error:
            raise ValueError(f"invalid_date: {location} is not a calendar date") from error
        require(previous is None or previous < current,
                f"non_ascending_dates: {location} must follow the previous date")
        previous = current

    node_ids = set()
    for key in ("nodes", "edges", "events"):
        for index, item in enumerate(data[key]):
            location = f"{key}[{index}]"
            require(isinstance(item, dict), f"shape: {location} must be an object")
            day = item.get("day")
            require(type(day) is int and 0 <= day < len(data["dates"]),
                    f"day_out_of_range: {location}.day must be an index into dates")
            if key == "nodes":
                node_id = item.get("id")
                require(isinstance(node_id, str) and node_id.strip(),
                        f"invalid_node_id: {location}.id must be a non-empty string")
                require(node_id not in node_ids, f"duplicate_node_id: {location}.id duplicates {node_id!r}")
                node_ids.add(node_id)
                require(item.get("cluster") in clusters, f"bad_cluster: {location}.cluster is unsupported")
            elif key == "edges":
                for endpoint in ("a", "b"):
                    reference = item.get(endpoint)
                    require(isinstance(reference, str) and reference in node_ids,
                            f"edge_to_missing_node: {location}.{endpoint} must reference a node")
                require(item.get("t") in edge_types, f"bad_edge_type: {location}.t is unsupported")
            elif "node" in item:
                reference = item["node"]
                require(isinstance(reference, str) and reference in node_ids,
                        f"event_to_missing_node: {location}.node must reference a node")


def allowed_values(markup):
    values = []
    for name in ("COLORS", "TNAME"):
        definitions = list(assignments(markup, name))
        require(definitions, f"missing {name} lookup table")
        keys = tuple(read_literal(*definitions[0]))
        require(keys, f"empty {name} lookup table")
        values.append(keys)
    return values


def template(version):
    return (ROOT / "assets" / TEMPLATES[version]).read_text(encoding="utf-8")


def check_template(version):
    return f"{len(template(version))} UTF-8 characters read"


def definition(version):
    name = "DATA" if version == "v1" else "window.CM_DATA"
    definitions = list(assignments(Markup(template(version)), name))
    require(len(definitions) == 1, f"expected one {name} assignment, found {len(definitions)}")
    return definitions[0]


def check_definition(version):
    definition(version)
    return "one assignment"


def check_sample(version):
    source = Markup(template(version))
    data = read_literal(*definition(version))
    validate(data, *allowed_values(source))
    return f"{len(data['nodes'])} nodes, {len(data['edges'])} edges, {len(data['events'])} events"


def check_control(version, control):
    count = Markup(template(version)).buttons.count(control)
    require(count == 1, f"expected one button with ID {control}, found {count}")
    return "button found"


def check_vault_ios():
    markup = Markup(template("v2.1"))
    require(any(re.search(r"\bDATA\.vaultIOS\b", script) for script in markup.scripts),
            "missing DATA.vaultIOS reference")
    return "DATA.vaultIOS referenced"


def check_note_vault(builder, helper):
    markup = Markup(template("v2.1"))
    declaration = rf"\bfunction\s+{helper}\(\)"
    call = rf"\bfunction\s+{builder}\([^)]*\)\{{[^}}]*encodeURIComponent\({helper}\(\)\)"
    require(any(re.search(declaration, script) and re.search(call, script)
                for script in markup.scripts),
            f"expected {builder} to call {helper} when building the note URL")
    return f"{builder} uses {helper}"


def check_browser_element(element):
    count = Markup(template("v2.1")).ids.count(element)
    require(count == 1, f"expected one element with ID {element}, found {count}")
    return "element found"


def check_browser_url():
    markup = Markup(template("v2.1"))
    require(any("window.hatchWidget.getState" in script
                and re.search(r'\.setAttribute\("href",\s*window\.CM_DATA\.browserUrl\)', script)
                for script in markup.scripts),
            "expected the controller to wire browserUrl to the link")
    return "controller wires browserUrl"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def check_fixture(rule, allowed):
    data = read_json(FIXTURES / f"{rule}.json")
    try:
        validate(data, *allowed())
    except ValueError as error:
        require(str(error).partition(":")[0] == rule, f"expected {rule}, got {error}")
        return str(error)
    raise ValueError(f"expected {rule}, fixture was accepted")


def check_readme():
    source = (ROOT / "README.md").read_text(encoding="utf-8")
    # The README uses inline Markdown and raw HTML. Also check destinations
    # declared by Markdown reference definitions.
    destination = r"<([^>\n]+)>|([^\s()]+(?:\([^\s()]*\)[^\s()]*)*)"
    inline = re.compile(r"(?<!\\)\[[^\]\n]*\]\(\s*(?:" + destination + r")")
    references = re.compile(r"^ {0,3}\[[^\]\n]+\]:[ \t]*(?:" + destination + r")", re.M)
    targets = [match[1] or match[2] for pattern in (inline, references)
               for match in pattern.finditer(source)]
    targets.extend(Markup(source).targets)
    relative = set()
    for target in filter(None, targets):
        url = urlsplit(target)
        if not url.scheme and not url.netloc and url.path and not url.path.startswith("/"):
            relative.add(unquote(url.path))
    missing = sorted(target for target in relative
                     if not (ROOT / target).resolve().is_relative_to(ROOT)
                     or not (ROOT / target).exists())
    require(not missing, "missing relative targets: " + ", ".join(missing))
    return f"{len(relative)} relative targets exist"


def check_frontmatter():
    lines = (ROOT / "SKILL.md").read_text(encoding="utf-8").splitlines()
    require(lines and lines[0] == "---" and "---" in lines[1:], "missing opening YAML frontmatter")
    end = lines.index("---", 1)
    for key in ("name", "description"):
        require(any(re.fullmatch(rf"{key}:[ \t]*\S.*", line) for line in lines[1:end]),
                f"missing frontmatter field {key}")
    return "name and description found"


def check_scrub(denylist):
    # Build the placeholder without placing its literal in the scanned tree.
    terms = ["TODO_" + "SCRUB_CHECK"]
    if denylist:
        terms.extend(line.strip() for line in denylist.read_text(encoding="utf-8").splitlines()
                     if line.strip())
    needles = [term.encode("utf-8") for term in terms]

    def raise_walk_error(error):
        raise error

    matches = []
    for directory, dirs, files in os.walk(ROOT, onerror=raise_walk_error):
        parent = Path(directory)
        dirs[:] = sorted(name for name in dirs if name != ".git" and parent / name != FIXTURES)
        for name in sorted(files):
            path = parent / name
            if name != ".git" and path.is_file():
                content = path.read_bytes()
                if any(needle in content for needle in needles):
                    matches.append(str(path.relative_to(ROOT)))
    require(not matches, "scrub term found in " + ", ".join(matches))
    return "no scrub terms found"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, help="validate an external CM_DATA JSON file")
    parser.add_argument("--denylist", type=Path, help="add literal UTF-8 scrub terms, one per line")
    args = parser.parse_args()
    results = []

    def check(name, action, *arguments):
        try:
            detail = action(*arguments)
        except (OSError, ValueError, RecursionError) as error:
            print(f"FAIL {name} — {' '.join(str(error).splitlines())}")
            results.append(False)
        else:
            print(f"PASS {name} — {detail}")
            results.append(True)

    def current_allowed():
        return allowed_values(Markup(template("v2.1")))

    def check_external():
        validate(read_json(args.data), *current_allowed())
        return "valid CM_DATA"

    def check_charset(version):
        require(template(version).partition("\n")[0] == '<meta charset="utf-8">',
                "first line must declare UTF-8")
        return "UTF-8 declared on the first line"

    if args.data is not None:
        check("external CM_DATA", check_external)
    else:
        for version in TEMPLATES:
            check(f"{version} template", check_template, version)
            if version != "v1":
                check(f"{version} charset", check_charset, version)
            check(f"{version} definition count", check_definition, version)
            for control in CONTROLS.get(version, ()):
                check(f"{version} {control}", check_control, version, control)
            if version == "v2.1":
                check("v2.1 vaultIOS", check_vault_ios)
                check("v2.1 graph note vault", check_note_vault, "noteURL", "vaultName")
                check("v2.1 card note vault", check_note_vault, "noteURL2", "vaultName2")
                for element in ("cmxBrowserSeg", "cmxBrowserBtn", "cmxHelpBrowser"):
                    check(f"v2.1 {element}", check_browser_element, element)
                check("v2.1 browserUrl", check_browser_url)
            check(f"{version} sample CM_DATA", check_sample, version)

        for rule in ("duplicate_node_id", "edge_to_missing_node", "event_to_missing_node",
                     "day_out_of_range", "bad_cluster", "bad_edge_type", "non_ascending_dates"):
            check(f"fixture {rule}", check_fixture, rule, current_allowed)
        check("README relative targets", check_readme)
        check("SKILL YAML frontmatter", check_frontmatter)

    if args.data is None or args.denylist is not None:
        check("repository scrub", check_scrub, args.denylist)
    print(f"{len(results)} checks, {sum(results)} passed, {results.count(False)} failed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
