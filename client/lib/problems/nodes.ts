// Linked lists and binary trees as problem parameter / return types.
// Browser-safe and self-contained (relative type imports only) like starters.ts.
//
// I/O format, the same in every language:
//   ListNode  the values in order, space-separated:              1 2 3     (empty line = empty list)
//   TreeNode  level order, space-separated, null for no child:   3 9 20 null null 15 7
//             trailing nulls are dropped; an empty line is an empty tree
//
// Every starter has a marked "node classes" section near the top. It holds
// either the ready-made classes ("provided") or a comment describing what the
// test harness needs so people can write the classes themselves
// ("write your own"). applyNodeMode swaps one for the other in place.

import type { LanguageId } from "../languages";

export const NODE_TYPES = ["ListNode", "TreeNode"] as const;
export type NodeType = (typeof NODE_TYPES)[number];
export type NodeMode = "provided" | "scratch";

export const nodeOf = (type: string): NodeType | null => ((NODE_TYPES as readonly string[]).includes(type) ? (type as NodeType) : null);

/** Which node types a signature uses, in a stable order. */
export function nodeKinds(sig: { params: { type: string }[]; returns: string }): NodeType[] {
  const used = new Set([...sig.params.map((p) => p.type), sig.returns]);
  return NODE_TYPES.filter((k) => used.has(k));
}

type LangNodes = {
  /** Line comment prefix. */
  c: string;
  /** Type of a parameter / return value. */
  type: Record<NodeType, string>;
  nil: string;
  classes: Record<NodeType, string>;
  /** What the harness needs from a hand-written class (one comment line each). */
  contract: Record<NodeType, string>;
  /** Expression that builds a value from one input line. */
  read: (k: NodeType, line: string) => string;
  /** Expression that turns a value into its output string. */
  str: (k: NodeType, v: string) => string;
  /** Harness functions (build + to-string), keyed by kind. */
  helpers: Record<NodeType, string>;
};

const R = String.raw;

const LANG: Partial<Record<LanguageId, LangNodes>> = {
  // ---------------------------------------------------------------- Python
  python: {
    c: "#",
    type: { ListNode: "Optional[ListNode]", TreeNode: "Optional[TreeNode]" },
    nil: "None",
    classes: {
      ListNode: R`class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next`,
      TreeNode: R`class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right`,
    },
    contract: {
      ListNode: "ListNode(val) with attributes val and next (next starts as None)",
      TreeNode: "TreeNode(val) with attributes val, left and right (children start as None)",
    },
    read: (k, l) => (k === "ListNode" ? `build_list(${l})` : `build_tree(${l})`),
    str: (k, v) => (k === "ListNode" ? `list_str(${v})` : `tree_str(${v})`),
    helpers: {
      ListNode: R`def build_list(s):
    head = None
    for v in reversed(s.split()):
        node = ListNode(int(v))
        node.next = head
        head = node
    return head


def list_str(node):
    parts = []
    while node is not None and len(parts) < 1000000:
        parts.append(str(node.val))
        node = node.next
    return " ".join(parts)`,
      TreeNode: R`def build_tree(s):
    t = s.split()
    if not t or t[0] == "null":
        return None
    root = TreeNode(int(t[0]))
    q = [root]
    i = 1
    h = 0
    while h < len(q) and i < len(t):
        node = q[h]
        h += 1
        if i < len(t) and t[i] != "null":
            node.left = TreeNode(int(t[i]))
            q.append(node.left)
        i += 1
        if i < len(t) and t[i] != "null":
            node.right = TreeNode(int(t[i]))
            q.append(node.right)
        i += 1
    return root


def tree_str(root):
    parts = []
    q = [root]
    h = 0
    while h < len(q):
        node = q[h]
        h += 1
        if node is None:
            parts.append("null")
            continue
        parts.append(str(node.val))
        q.append(node.left)
        q.append(node.right)
    while parts and parts[-1] == "null":
        parts.pop()
    return " ".join(parts)`,
    },
  },

  // ------------------------------------------------------------------ Java
  java: {
    c: "//",
    type: { ListNode: "ListNode", TreeNode: "TreeNode" },
    nil: "null",
    classes: {
      ListNode: R`class ListNode {
    int val;
    ListNode next;
    ListNode(int val) { this.val = val; }
}`,
      TreeNode: R`class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode(int val) { this.val = val; }
}`,
    },
    contract: {
      ListNode: "new ListNode(int val), with fields int val and ListNode next",
      TreeNode: "new TreeNode(int val), with fields int val, TreeNode left and TreeNode right",
    },
    read: (k, l) => (k === "ListNode" ? `buildList(${l})` : `buildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `listStr(${v})` : `treeStr(${v})`),
    helpers: {
      ListNode: R`    static ListNode buildList(String s) {
        String x = s.trim();
        String[] t = x.isEmpty() ? new String[0] : x.split("\\s+");
        ListNode head = null;
        for (int i = t.length - 1; i >= 0; i--) {
            ListNode n = new ListNode(Integer.parseInt(t[i]));
            n.next = head;
            head = n;
        }
        return head;
    }

    static String listStr(ListNode node) {
        StringBuilder sb = new StringBuilder();
        for (int k = 0; node != null && k < 1000000; k++, node = node.next) sb.append(k > 0 ? " " : "").append(node.val);
        return sb.toString();
    }`,
      TreeNode: R`    static TreeNode buildTree(String s) {
        String x = s.trim();
        String[] t = x.isEmpty() ? new String[0] : x.split("\\s+");
        if (t.length == 0 || t[0].equals("null")) return null;
        TreeNode root = new TreeNode(Integer.parseInt(t[0]));
        List<TreeNode> q = new ArrayList<>();
        q.add(root);
        int i = 1;
        for (int h = 0; h < q.size() && i < t.length; h++) {
            TreeNode n = q.get(h);
            if (i < t.length && !t[i].equals("null")) { n.left = new TreeNode(Integer.parseInt(t[i])); q.add(n.left); }
            i++;
            if (i < t.length && !t[i].equals("null")) { n.right = new TreeNode(Integer.parseInt(t[i])); q.add(n.right); }
            i++;
        }
        return root;
    }

    static String treeStr(TreeNode root) {
        List<String> parts = new ArrayList<>();
        List<TreeNode> q = new ArrayList<>();
        q.add(root);
        for (int h = 0; h < q.size(); h++) {
            TreeNode n = q.get(h);
            if (n == null) { parts.add("null"); continue; }
            parts.add(String.valueOf(n.val));
            q.add(n.left);
            q.add(n.right);
        }
        while (!parts.isEmpty() && parts.get(parts.size() - 1).equals("null")) parts.remove(parts.size() - 1);
        return String.join(" ", parts);
    }`,
    },
  },

  // --------------------------------------------------------------------- C
  c: {
    c: "//",
    type: { ListNode: "struct ListNode*", TreeNode: "struct TreeNode*" },
    nil: "NULL",
    classes: {
      ListNode: R`struct ListNode {
    int val;
    struct ListNode* next;
};`,
      TreeNode: R`struct TreeNode {
    int val;
    struct TreeNode* left;
    struct TreeNode* right;
};`,
    },
    contract: {
      ListNode: "struct ListNode { int val; struct ListNode* next; } (the harness allocates nodes with malloc)",
      TreeNode: "struct TreeNode { int val; struct TreeNode* left; struct TreeNode* right; } (allocated with malloc)",
    },
    read: (k, l) => (k === "ListNode" ? `build_list(${l})` : `build_tree(${l})`),
    str: () => "",
    helpers: {
      ListNode: R`static struct ListNode* build_list(const char* s) {
    Tok k = tok(s);
    struct ListNode* head = NULL;
    for (int i = k.n - 1; i >= 0; i--) {
        struct ListNode* n = malloc(sizeof(struct ListNode));
        n->val = atoi(k.t[i]);
        n->next = head;
        head = n;
    }
    return head;
}

static void print_list(struct ListNode* node) {
    for (int k = 0; node && k < 1000000; k++, node = node->next) printf(k ? " %d" : "%d", node->val);
    printf("\n");
}`,
      TreeNode: R`static struct TreeNode* new_tree_node(int v) {
    struct TreeNode* n = malloc(sizeof(struct TreeNode));
    n->val = v;
    n->left = n->right = NULL;
    return n;
}

static struct TreeNode* build_tree(const char* s) {
    Tok k = tok(s);
    if (k.n == 0 || strcmp(k.t[0], "null") == 0) return NULL;
    struct TreeNode** q = malloc(k.n * sizeof(struct TreeNode*));
    int qn = 0, i = 1;
    struct TreeNode* root = new_tree_node(atoi(k.t[0]));
    q[qn++] = root;
    for (int h = 0; h < qn && i < k.n; h++) {
        struct TreeNode* n = q[h];
        if (i < k.n && strcmp(k.t[i], "null") != 0) { n->left = new_tree_node(atoi(k.t[i])); q[qn++] = n->left; }
        i++;
        if (i < k.n && strcmp(k.t[i], "null") != 0) { n->right = new_tree_node(atoi(k.t[i])); q[qn++] = n->right; }
        i++;
    }
    free(q);
    return root;
}

static void print_tree(struct TreeNode* root) {
    int cap = 64, qn = 0, last = -1;
    struct TreeNode** q = malloc(cap * sizeof(struct TreeNode*));
    q[qn++] = root;
    for (int h = 0; h < qn; h++) {
        if (!q[h]) continue;
        last = h;
        if (qn + 2 > cap) q = realloc(q, (cap *= 2) * sizeof(struct TreeNode*));
        q[qn++] = q[h]->left;
        q[qn++] = q[h]->right;
    }
    for (int h = 0; h <= last; h++) {
        if (h) printf(" ");
        if (q[h]) printf("%d", q[h]->val);
        else printf("null");
    }
    printf("\n");
    free(q);
}`,
    },
  },

  // ------------------------------------------------------------------- C++
  cpp: {
    c: "//",
    type: { ListNode: "ListNode*", TreeNode: "TreeNode*" },
    nil: "nullptr",
    classes: {
      ListNode: R`struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};`,
      TreeNode: R`struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};`,
    },
    contract: {
      ListNode: "new ListNode(int val), with members int val and ListNode* next",
      TreeNode: "new TreeNode(int val), with members int val, TreeNode* left and TreeNode* right",
    },
    read: (k, l) => (k === "ListNode" ? `buildList(${l})` : `buildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `listStr(${v})` : `treeStr(${v})`),
    helpers: {
      ListNode: R`static ListNode* buildList(const string& s) {
    Tok k(s);
    ListNode* head = nullptr;
    for (int i = (int)k.t.size() - 1; i >= 0; i--) {
        ListNode* n = new ListNode(stoi(k.t[i]));
        n->next = head;
        head = n;
    }
    return head;
}

static string listStr(ListNode* node) {
    string s;
    for (int k = 0; node && k < 1000000; k++, node = node->next) s += (k ? " " : "") + to_string(node->val);
    return s;
}`,
      TreeNode: R`static TreeNode* buildTree(const string& s) {
    Tok k(s);
    if (k.t.empty() || k.t[0] == "null") return nullptr;
    TreeNode* root = new TreeNode(stoi(k.t[0]));
    vector<TreeNode*> q{root};
    size_t i = 1;
    for (size_t h = 0; h < q.size() && i < k.t.size(); h++) {
        TreeNode* n = q[h];
        if (i < k.t.size() && k.t[i] != "null") { n->left = new TreeNode(stoi(k.t[i])); q.push_back(n->left); }
        i++;
        if (i < k.t.size() && k.t[i] != "null") { n->right = new TreeNode(stoi(k.t[i])); q.push_back(n->right); }
        i++;
    }
    return root;
}

static string treeStr(TreeNode* root) {
    vector<TreeNode*> q{root};
    vector<string> parts;
    for (size_t h = 0; h < q.size(); h++) {
        TreeNode* n = q[h];
        if (!n) { parts.push_back("null"); continue; }
        parts.push_back(to_string(n->val));
        q.push_back(n->left);
        q.push_back(n->right);
    }
    while (!parts.empty() && parts.back() == "null") parts.pop_back();
    string s;
    for (size_t i = 0; i < parts.size(); i++) s += (i ? " " : "") + parts[i];
    return s;
}`,
    },
  },

  // -------------------------------------------------------------------- C#
  csharp: {
    c: "//",
    type: { ListNode: "ListNode", TreeNode: "TreeNode" },
    nil: "null",
    classes: {
      ListNode: R`public class ListNode {
    public int val;
    public ListNode next;
    public ListNode(int val = 0, ListNode next = null) { this.val = val; this.next = next; }
}`,
      TreeNode: R`public class TreeNode {
    public int val;
    public TreeNode left;
    public TreeNode right;
    public TreeNode(int val = 0, TreeNode left = null, TreeNode right = null) { this.val = val; this.left = left; this.right = right; }
}`,
    },
    contract: {
      ListNode: "new ListNode(int val), with public fields int val and ListNode next",
      TreeNode: "new TreeNode(int val), with public fields int val, TreeNode left and TreeNode right",
    },
    read: (k, l) => (k === "ListNode" ? `BuildList(${l})` : `BuildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `ListStr(${v})` : `TreeStr(${v})`),
    helpers: {
      ListNode: R`    static ListNode BuildList(string s) {
        var t = s.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        ListNode head = null;
        for (int i = t.Length - 1; i >= 0; i--) {
            var n = new ListNode(int.Parse(t[i]));
            n.next = head;
            head = n;
        }
        return head;
    }

    static string ListStr(ListNode node) {
        var parts = new List<string>();
        for (int k = 0; node != null && k < 1000000; k++, node = node.next) parts.Add(node.val.ToString());
        return string.Join(" ", parts);
    }`,
      TreeNode: R`    static TreeNode BuildTree(string s) {
        var t = s.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        if (t.Length == 0 || t[0] == "null") return null;
        var root = new TreeNode(int.Parse(t[0]));
        var q = new List<TreeNode> { root };
        int i = 1;
        for (int h = 0; h < q.Count && i < t.Length; h++) {
            var n = q[h];
            if (i < t.Length && t[i] != "null") { n.left = new TreeNode(int.Parse(t[i])); q.Add(n.left); }
            i++;
            if (i < t.Length && t[i] != "null") { n.right = new TreeNode(int.Parse(t[i])); q.Add(n.right); }
            i++;
        }
        return root;
    }

    static string TreeStr(TreeNode root) {
        var q = new List<TreeNode> { root };
        var parts = new List<string>();
        for (int h = 0; h < q.Count; h++) {
            var n = q[h];
            if (n == null) { parts.Add("null"); continue; }
            parts.Add(n.val.ToString());
            q.Add(n.left);
            q.Add(n.right);
        }
        while (parts.Count > 0 && parts[parts.Count - 1] == "null") parts.RemoveAt(parts.Count - 1);
        return string.Join(" ", parts);
    }`,
    },
  },

  // -------------------------------------------------------------------- Go
  go: {
    c: "//",
    type: { ListNode: "*ListNode", TreeNode: "*TreeNode" },
    nil: "nil",
    classes: {
      ListNode: R`type ListNode struct {
	Val  int
	Next *ListNode
}`,
      TreeNode: R`type TreeNode struct {
	Val   int
	Left  *TreeNode
	Right *TreeNode
}`,
    },
    contract: {
      ListNode: "type ListNode struct with fields Val int and Next *ListNode",
      TreeNode: "type TreeNode struct with fields Val int, Left *TreeNode and Right *TreeNode",
    },
    read: (k, l) => (k === "ListNode" ? `buildList(${l})` : `buildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `listStr(${v})` : `treeStr(${v})`),
    helpers: {
      ListNode: R`func buildList(s string) *ListNode {
	f := strings.Fields(s)
	var head *ListNode
	for i := len(f) - 1; i >= 0; i-- {
		head = &ListNode{Val: atoi(f[i]), Next: head}
	}
	return head
}

func listStr(node *ListNode) string {
	parts := []string{}
	for k := 0; node != nil && k < 1000000; k++ {
		parts = append(parts, fmt.Sprint(node.Val))
		node = node.Next
	}
	return strings.Join(parts, " ")
}`,
      TreeNode: R`func buildTree(s string) *TreeNode {
	f := strings.Fields(s)
	if len(f) == 0 || f[0] == "null" {
		return nil
	}
	root := &TreeNode{Val: atoi(f[0])}
	q := []*TreeNode{root}
	i := 1
	for h := 0; h < len(q) && i < len(f); h++ {
		n := q[h]
		if i < len(f) && f[i] != "null" {
			n.Left = &TreeNode{Val: atoi(f[i])}
			q = append(q, n.Left)
		}
		i++
		if i < len(f) && f[i] != "null" {
			n.Right = &TreeNode{Val: atoi(f[i])}
			q = append(q, n.Right)
		}
		i++
	}
	return root
}

func treeStr(root *TreeNode) string {
	q := []*TreeNode{root}
	parts := []string{}
	for h := 0; h < len(q); h++ {
		n := q[h]
		if n == nil {
			parts = append(parts, "null")
			continue
		}
		parts = append(parts, fmt.Sprint(n.Val))
		q = append(q, n.Left, n.Right)
	}
	for len(parts) > 0 && parts[len(parts)-1] == "null" {
		parts = parts[:len(parts)-1]
	}
	return strings.Join(parts, " ")
}`,
    },
  },

  // ------------------------------------------------------------------ Rust
  rust: {
    c: "//",
    type: { ListNode: "Option<Box<ListNode>>", TreeNode: "Option<Rc<RefCell<TreeNode>>>" },
    nil: "None",
    classes: {
      ListNode: R`#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}

impl ListNode {
    pub fn new(val: i32) -> Self {
        ListNode { val, next: None }
    }
}`,
      TreeNode: R`#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<Rc<RefCell<TreeNode>>>,
    pub right: Option<Rc<RefCell<TreeNode>>>,
}

impl TreeNode {
    pub fn new(val: i32) -> Self {
        TreeNode { val, left: None, right: None }
    }
}`,
    },
    contract: {
      ListNode: "ListNode::new(val: i32), with pub fields val: i32 and next: Option<Box<ListNode>>",
      TreeNode: "TreeNode::new(val: i32), with pub fields val: i32 and left/right: Option<Rc<RefCell<TreeNode>>>",
    },
    read: (k, l) => (k === "ListNode" ? `build_list(${l})` : `build_tree(${l})`),
    str: (k, v) => (k === "ListNode" ? `list_str(&${v})` : `tree_str(&${v})`),
    helpers: {
      ListNode: R`fn build_list(s: &str) -> Option<Box<ListNode>> {
    let mut head: Option<Box<ListNode>> = None;
    for v in s.split_whitespace().rev() {
        let mut node = Box::new(ListNode::new(v.parse().unwrap()));
        node.next = head;
        head = Some(node);
    }
    head
}

fn list_str(head: &Option<Box<ListNode>>) -> String {
    let mut parts: Vec<String> = Vec::new();
    let mut cur = head;
    while let Some(node) = cur {
        if parts.len() >= 1000000 {
            break;
        }
        parts.push(node.val.to_string());
        cur = &node.next;
    }
    parts.join(" ")
}`,
      TreeNode: R`fn build_tree(s: &str) -> Option<Rc<RefCell<TreeNode>>> {
    let t: Vec<&str> = s.split_whitespace().collect();
    if t.is_empty() || t[0] == "null" {
        return None;
    }
    let root = Rc::new(RefCell::new(TreeNode::new(t[0].parse().unwrap())));
    let mut q: VecDeque<Rc<RefCell<TreeNode>>> = VecDeque::new();
    q.push_back(Rc::clone(&root));
    let mut i = 1;
    while let Some(node) = q.pop_front() {
        if i >= t.len() {
            break;
        }
        if t[i] != "null" {
            let child = Rc::new(RefCell::new(TreeNode::new(t[i].parse().unwrap())));
            node.borrow_mut().left = Some(Rc::clone(&child));
            q.push_back(child);
        }
        i += 1;
        if i < t.len() && t[i] != "null" {
            let child = Rc::new(RefCell::new(TreeNode::new(t[i].parse().unwrap())));
            node.borrow_mut().right = Some(Rc::clone(&child));
            q.push_back(child);
        }
        i += 1;
    }
    Some(root)
}

fn tree_str(root: &Option<Rc<RefCell<TreeNode>>>) -> String {
    let mut parts: Vec<String> = Vec::new();
    let mut q: VecDeque<Option<Rc<RefCell<TreeNode>>>> = VecDeque::new();
    q.push_back(root.clone());
    while let Some(n) = q.pop_front() {
        match n {
            None => parts.push("null".to_string()),
            Some(rc) => {
                let b = rc.borrow();
                parts.push(b.val.to_string());
                q.push_back(b.left.clone());
                q.push_back(b.right.clone());
            }
        }
    }
    while parts.last().map_or(false, |s| s == "null") {
        parts.pop();
    }
    parts.join(" ")
}`,
    },
  },

  // ---------------------------------------------------------------- Kotlin
  kotlin: {
    c: "//",
    type: { ListNode: "ListNode?", TreeNode: "TreeNode?" },
    nil: "null",
    classes: {
      ListNode: R`class ListNode(var ${"`val`"}: Int) {
    var next: ListNode? = null
}`,
      TreeNode: R`class TreeNode(var ${"`val`"}: Int) {
    var left: TreeNode? = null
    var right: TreeNode? = null
}`,
    },
    contract: {
      ListNode: "ListNode(`val`: Int), with properties `val` and next: ListNode?",
      TreeNode: "TreeNode(`val`: Int), with properties `val`, left: TreeNode? and right: TreeNode?",
    },
    read: (k, l) => (k === "ListNode" ? `buildList(${l})` : `buildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `listStr(${v})` : `treeStr(${v})`),
    helpers: {
      ListNode: R`fun buildList(s: String): ListNode? {
    val t = s.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    var head: ListNode? = null
    for (i in t.indices.reversed()) {
        val n = ListNode(t[i].toInt())
        n.next = head
        head = n
    }
    return head
}

fun listStr(head: ListNode?): String {
    val parts = mutableListOf<String>()
    var node = head
    while (node != null && parts.size < 1000000) {
        parts.add(node.${"`val`"}.toString())
        node = node.next
    }
    return parts.joinToString(" ")
}`,
      TreeNode: R`fun buildTree(s: String): TreeNode? {
    val t = s.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (t.isEmpty() || t[0] == "null") return null
    val root = TreeNode(t[0].toInt())
    val q = mutableListOf(root)
    var i = 1
    var h = 0
    while (h < q.size && i < t.size) {
        val n = q[h++]
        if (i < t.size && t[i] != "null") { val c = TreeNode(t[i].toInt()); n.left = c; q.add(c) }
        i++
        if (i < t.size && t[i] != "null") { val c = TreeNode(t[i].toInt()); n.right = c; q.add(c) }
        i++
    }
    return root
}

fun treeStr(root: TreeNode?): String {
    val q = mutableListOf<TreeNode?>(root)
    val parts = mutableListOf<String>()
    var h = 0
    while (h < q.size) {
        val n = q[h++]
        if (n == null) { parts.add("null"); continue }
        parts.add(n.${"`val`"}.toString())
        q.add(n.left)
        q.add(n.right)
    }
    while (parts.isNotEmpty() && parts.last() == "null") parts.removeAt(parts.size - 1)
    return parts.joinToString(" ")
}`,
    },
  },

  // ----------------------------------------------------------------- Swift
  swift: {
    c: "//",
    type: { ListNode: "ListNode?", TreeNode: "TreeNode?" },
    nil: "nil",
    classes: {
      ListNode: R`public class ListNode {
    public var val: Int
    public var next: ListNode?
    public init(_ val: Int) { self.val = val; self.next = nil }
}`,
      TreeNode: R`public class TreeNode {
    public var val: Int
    public var left: TreeNode?
    public var right: TreeNode?
    public init(_ val: Int) { self.val = val; self.left = nil; self.right = nil }
}`,
    },
    contract: {
      ListNode: "ListNode(_ val: Int), a class with var val: Int and var next: ListNode?",
      TreeNode: "TreeNode(_ val: Int), a class with var val: Int, var left: TreeNode? and var right: TreeNode?",
    },
    read: (k, l) => (k === "ListNode" ? `buildList(${l})` : `buildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `listStr(${v})` : `treeStr(${v})`),
    helpers: {
      ListNode: R`func buildList(_ s: String) -> ListNode? {
    let t = s.split(whereSeparator: { $0 == " " || $0 == "\t" }).map(String.init)
    var head: ListNode? = nil
    for v in t.reversed() {
        let n = ListNode(Int(v)!)
        n.next = head
        head = n
    }
    return head
}

func listStr(_ head: ListNode?) -> String {
    var parts: [String] = []
    var node = head
    while let n = node, parts.count < 1000000 {
        parts.append(String(n.val))
        node = n.next
    }
    return parts.joined(separator: " ")
}`,
      TreeNode: R`func buildTree(_ s: String) -> TreeNode? {
    let t = s.split(whereSeparator: { $0 == " " || $0 == "\t" }).map(String.init)
    if t.isEmpty || t[0] == "null" { return nil }
    let root = TreeNode(Int(t[0])!)
    var q: [TreeNode] = [root]
    var i = 1
    var h = 0
    while h < q.count && i < t.count {
        let n = q[h]
        h += 1
        if i < t.count && t[i] != "null" { let c = TreeNode(Int(t[i])!); n.left = c; q.append(c) }
        i += 1
        if i < t.count && t[i] != "null" { let c = TreeNode(Int(t[i])!); n.right = c; q.append(c) }
        i += 1
    }
    return root
}

func treeStr(_ root: TreeNode?) -> String {
    var q: [TreeNode?] = [root]
    var parts: [String] = []
    var h = 0
    while h < q.count {
        let n = q[h]
        h += 1
        guard let node = n else { parts.append("null"); continue }
        parts.append(String(node.val))
        q.append(node.left)
        q.append(node.right)
    }
    while parts.last == "null" { parts.removeLast() }
    return parts.joined(separator: " ")
}`,
    },
  },

  // ------------------------------------------------------------------ Ruby
  ruby: {
    c: "#",
    type: { ListNode: "", TreeNode: "" },
    nil: "nil",
    classes: {
      ListNode: R`class ListNode
  attr_accessor :val, :next

  def initialize(val = 0, _next = nil)
    @val = val
    @next = _next
  end
end`,
      TreeNode: R`class TreeNode
  attr_accessor :val, :left, :right

  def initialize(val = 0, left = nil, right = nil)
    @val = val
    @left = left
    @right = right
  end
end`,
    },
    contract: {
      ListNode: "ListNode.new(val), with accessors val and next",
      TreeNode: "TreeNode.new(val), with accessors val, left and right",
    },
    read: (k, l) => (k === "ListNode" ? `build_list(${l})` : `build_tree(${l})`),
    str: (k, v) => (k === "ListNode" ? `list_str(${v})` : `tree_str(${v})`),
    helpers: {
      ListNode: R`def build_list(s)
  head = nil
  s.split.reverse_each do |v|
    n = ListNode.new(v.to_i)
    n.next = head
    head = n
  end
  head
end

def list_str(node)
  parts = []
  while node && parts.size < 1_000_000
    parts << node.val.to_s
    node = node.next
  end
  parts.join(" ")
end`,
      TreeNode: R`def build_tree(s)
  t = s.split
  return nil if t.empty? || t[0] == "null"
  root = TreeNode.new(t[0].to_i)
  q = [root]
  i = 1
  h = 0
  while h < q.size && i < t.size
    n = q[h]
    h += 1
    if i < t.size && t[i] != "null"
      n.left = TreeNode.new(t[i].to_i)
      q << n.left
    end
    i += 1
    if i < t.size && t[i] != "null"
      n.right = TreeNode.new(t[i].to_i)
      q << n.right
    end
    i += 1
  end
  root
end

def tree_str(root)
  q = [root]
  parts = []
  h = 0
  while h < q.size
    n = q[h]
    h += 1
    if n.nil?
      parts << "null"
      next
    end
    parts << n.val.to_s
    q << n.left << n.right
  end
  parts.pop while parts.last == "null"
  parts.join(" ")
end`,
    },
  },

  // ------------------------------------------------------------------- PHP
  php: {
    c: "//",
    type: { ListNode: "?ListNode", TreeNode: "?TreeNode" },
    nil: "null",
    classes: {
      ListNode: R`class ListNode {
    public $val = 0;
    public $next = null;
    function __construct($val = 0, $next = null) {
        $this->val = $val;
        $this->next = $next;
    }
}`,
      TreeNode: R`class TreeNode {
    public $val = 0;
    public $left = null;
    public $right = null;
    function __construct($val = 0, $left = null, $right = null) {
        $this->val = $val;
        $this->left = $left;
        $this->right = $right;
    }
}`,
    },
    contract: {
      ListNode: "new ListNode($val), with public properties $val and $next",
      TreeNode: "new TreeNode($val), with public properties $val, $left and $right",
    },
    read: (k, l) => (k === "ListNode" ? `buildList(${l})` : `buildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `listStr(${v})` : `treeStr(${v})`),
    helpers: {
      ListNode: R`function buildList(string $s): ?ListNode {
    $head = null;
    foreach (array_reverse(readWords($s)) as $v) {
        $n = new ListNode(intval($v));
        $n->next = $head;
        $head = $n;
    }
    return $head;
}

function listStr(?ListNode $node): string {
    $parts = [];
    while ($node !== null && count($parts) < 1000000) {
        $parts[] = (string)$node->val;
        $node = $node->next;
    }
    return implode(" ", $parts);
}`,
      TreeNode: R`function buildTree(string $s): ?TreeNode {
    $t = readWords($s);
    if (!$t || $t[0] === "null") return null;
    $root = new TreeNode(intval($t[0]));
    $q = [$root];
    $i = 1;
    for ($h = 0; $h < count($q) && $i < count($t); $h++) {
        $n = $q[$h];
        if ($i < count($t) && $t[$i] !== "null") { $n->left = new TreeNode(intval($t[$i])); $q[] = $n->left; }
        $i++;
        if ($i < count($t) && $t[$i] !== "null") { $n->right = new TreeNode(intval($t[$i])); $q[] = $n->right; }
        $i++;
    }
    return $root;
}

function treeStr(?TreeNode $root): string {
    $q = [$root];
    $parts = [];
    for ($h = 0; $h < count($q); $h++) {
        $n = $q[$h];
        if ($n === null) { $parts[] = "null"; continue; }
        $parts[] = (string)$n->val;
        $q[] = $n->left;
        $q[] = $n->right;
    }
    while ($parts && end($parts) === "null") array_pop($parts);
    return implode(" ", $parts);
}`,
    },
  },

  // ----------------------------------------------------------------- Scala
  scala: {
    c: "//",
    type: { ListNode: "ListNode", TreeNode: "TreeNode" },
    nil: "null",
    classes: {
      ListNode: R`class ListNode(var value: Int) {
  var next: ListNode = null
}`,
      TreeNode: R`class TreeNode(var value: Int) {
  var left: TreeNode = null
  var right: TreeNode = null
}`,
    },
    contract: {
      ListNode: "new ListNode(value: Int), with var value: Int and var next: ListNode",
      TreeNode: "new TreeNode(value: Int), with var value: Int, var left: TreeNode and var right: TreeNode",
    },
    read: (k, l) => (k === "ListNode" ? `buildList(${l})` : `buildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `listStr(${v})` : `treeStr(${v})`),
    helpers: {
      ListNode: R`  def buildList(s: String): ListNode = {
    val t = s.trim.split("\\s+").filter(_.nonEmpty)
    var head: ListNode = null
    for (v <- t.reverse) {
      val n = new ListNode(v.toInt)
      n.next = head
      head = n
    }
    head
  }

  def listStr(head: ListNode): String = {
    val parts = mutable.ArrayBuffer[String]()
    var node = head
    while (node != null && parts.length < 1000000) {
      parts += node.value.toString
      node = node.next
    }
    parts.mkString(" ")
  }`,
      TreeNode: R`  def buildTree(s: String): TreeNode = {
    val t = s.trim.split("\\s+").filter(_.nonEmpty)
    if (t.isEmpty || t(0) == "null") return null
    val root = new TreeNode(t(0).toInt)
    val q = mutable.ArrayBuffer[TreeNode](root)
    var i = 1
    var h = 0
    while (h < q.length && i < t.length) {
      val n = q(h)
      h += 1
      if (i < t.length && t(i) != "null") { val c = new TreeNode(t(i).toInt); n.left = c; q += c }
      i += 1
      if (i < t.length && t(i) != "null") { val c = new TreeNode(t(i).toInt); n.right = c; q += c }
      i += 1
    }
    root
  }

  def treeStr(root: TreeNode): String = {
    val q = mutable.ArrayBuffer[TreeNode](root)
    val parts = mutable.ArrayBuffer[String]()
    var h = 0
    while (h < q.length) {
      val n = q(h)
      h += 1
      if (n == null) parts += "null"
      else {
        parts += n.value.toString
        q += n.left
        q += n.right
      }
    }
    while (parts.nonEmpty && parts.last == "null") parts.remove(parts.length - 1)
    parts.mkString(" ")
  }`,
    },
  },

  // ------------------------------------------------------------------ Dart
  dart: {
    c: "//",
    type: { ListNode: "ListNode?", TreeNode: "TreeNode?" },
    nil: "null",
    classes: {
      ListNode: R`class ListNode {
  int val;
  ListNode? next;
  ListNode([this.val = 0, this.next]);
}`,
      TreeNode: R`class TreeNode {
  int val;
  TreeNode? left;
  TreeNode? right;
  TreeNode([this.val = 0, this.left, this.right]);
}`,
    },
    contract: {
      ListNode: "ListNode(int val), with fields int val and ListNode? next",
      TreeNode: "TreeNode(int val), with fields int val, TreeNode? left and TreeNode? right",
    },
    read: (k, l) => (k === "ListNode" ? `buildList(${l})` : `buildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `listStr(${v})` : `treeStr(${v})`),
    helpers: {
      ListNode: R`ListNode? buildList(String s) {
  final t = s.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  ListNode? head;
  for (var i = t.length - 1; i >= 0; i--) {
    final n = ListNode(int.parse(t[i]));
    n.next = head;
    head = n;
  }
  return head;
}

String listStr(ListNode? head) {
  final parts = <String>[];
  ListNode? node = head;
  while (node != null && parts.length < 1000000) {
    parts.add(node.val.toString());
    node = node.next;
  }
  return parts.join(' ');
}`,
      TreeNode: R`TreeNode? buildTree(String s) {
  final t = s.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (t.isEmpty || t[0] == 'null') return null;
  final root = TreeNode(int.parse(t[0]));
  final q = <TreeNode>[root];
  var i = 1;
  for (var h = 0; h < q.length && i < t.length; h++) {
    final n = q[h];
    if (i < t.length && t[i] != 'null') {
      final c = TreeNode(int.parse(t[i]));
      n.left = c;
      q.add(c);
    }
    i++;
    if (i < t.length && t[i] != 'null') {
      final c = TreeNode(int.parse(t[i]));
      n.right = c;
      q.add(c);
    }
    i++;
  }
  return root;
}

String treeStr(TreeNode? root) {
  final q = <TreeNode?>[root];
  final parts = <String>[];
  for (var h = 0; h < q.length; h++) {
    final n = q[h];
    if (n == null) {
      parts.add('null');
      continue;
    }
    parts.add(n.val.toString());
    q.add(n.left);
    q.add(n.right);
  }
  while (parts.isNotEmpty && parts.last == 'null') {
    parts.removeLast();
  }
  return parts.join(' ');
}`,
    },
  },
};

// JavaScript and TypeScript share everything except annotations.
function jsNodes(ts: boolean): LangNodes {
  const a = (s: string) => (ts ? s : "");
  return {
    c: "//",
    type: { ListNode: "ListNode | null", TreeNode: "TreeNode | null" },
    nil: "null",
    classes: {
      ListNode: ts
        ? R`class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val = 0, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}`
        : R`class ListNode {
  constructor(val = 0, next = null) {
    this.val = val;
    this.next = next;
  }
}`,
      TreeNode: ts
        ? R`class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
  constructor(val = 0, left: TreeNode | null = null, right: TreeNode | null = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}`
        : R`class TreeNode {
  constructor(val = 0, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}`,
    },
    contract: {
      ListNode: "new ListNode(val), with properties val and next (next starts as null)",
      TreeNode: "new TreeNode(val), with properties val, left and right (children start as null)",
    },
    read: (k, l) => (k === "ListNode" ? `buildList(${l})` : `buildTree(${l})`),
    str: (k, v) => (k === "ListNode" ? `listStr(${v})` : `treeStr(${v})`),
    helpers: {
      ListNode: `function buildList(s${a(": string")})${a(": ListNode | null")} {
  let head${a(": ListNode | null")} = null;
  const t = s.trim().split(/\\s+/).filter(Boolean);
  for (let i = t.length - 1; i >= 0; i--) {
    const n = new ListNode(Number(t[i]));
    n.next = head;
    head = n;
  }
  return head;
}

function listStr(node${a(": ListNode | null")})${a(": string")} {
  const parts${a(": string[]")} = [];
  for (; node && parts.length < 1e6; node = node.next) parts.push(String(node.val));
  return parts.join(" ");
}`,
      TreeNode: `function buildTree(s${a(": string")})${a(": TreeNode | null")} {
  const t = s.trim().split(/\\s+/).filter(Boolean);
  if (!t.length || t[0] === "null") return null;
  const root = new TreeNode(Number(t[0]));
  const q${a(": TreeNode[]")} = [root];
  let i = 1;
  for (let h = 0; h < q.length && i < t.length; h++) {
    const n = q[h];
    if (i < t.length && t[i] !== "null") {
      const c = new TreeNode(Number(t[i]));
      n.left = c;
      q.push(c);
    }
    i++;
    if (i < t.length && t[i] !== "null") {
      const c = new TreeNode(Number(t[i]));
      n.right = c;
      q.push(c);
    }
    i++;
  }
  return root;
}

function treeStr(root${a(": TreeNode | null")})${a(": string")} {
  const q${a(": (TreeNode | null)[]")} = [root];
  const parts${a(": string[]")} = [];
  for (let h = 0; h < q.length; h++) {
    const n = q[h];
    if (!n) {
      parts.push("null");
      continue;
    }
    parts.push(String(n.val));
    q.push(n.left, n.right);
  }
  while (parts.length && parts[parts.length - 1] === "null") parts.pop();
  return parts.join(" ");
}`,
    },
  };
}
LANG.javascript = jsNodes(false);
LANG.typescript = jsNodes(true);

/** Languages that can take node parameters (everything but Bash). */
export const nodeLang = (lang: LanguageId): LangNodes | null => LANG[lang] ?? null;

const BEGIN = (c: string, mode: NodeMode) => `${c} ── Node classes (${mode === "provided" ? "provided" : "write your own"}) ──`;
const END = (c: string) => `${c} ── end node classes ──`;

/** The marked node-classes section for a starter, in either mode. Empty if the signature has no node types. */
export function nodeBlock(lang: LanguageId, kinds: NodeType[], mode: NodeMode): string {
  const L = nodeLang(lang);
  if (!L || !kinds.length) return "";
  const body =
    mode === "provided"
      ? kinds.map((k) => L.classes[k]).join("\n\n")
      : [
          `${L.c} Define ${kinds.join(" and ")} yourself. The code that reads the input and`,
          `${L.c} prints your answer (below solve) uses:`,
          ...kinds.map((k) => `${L.c}   ${L.contract[k]}`),
          `${L.c} Prefer the ready-made version? Switch "Node classes" to Provided.`,
        ].join("\n");
  return `${BEGIN(L.c, mode)}\n${body}\n${END(L.c)}`;
}

/** Harness helpers for the node kinds a signature uses. */
export function nodeHelpers(lang: LanguageId, kinds: NodeType[]): string {
  const L = nodeLang(lang);
  return L ? kinds.map((k) => L.helpers[k]).join(lang === "python" ? "\n\n\n" : "\n\n") : "";
}

const BLOCK_RE = /^[ \t]*(?:\/\/|#) ── Node classes \((provided|write your own)\) ──[^\n]*\n[\s\S]*?^[ \t]*(?:\/\/|#) ── end node classes ──[^\n]*$/m;

/** Which mode a starter's node section is in, or null if it has none. */
export function nodeModeOf(code: string): NodeMode | null {
  const m = BLOCK_RE.exec(code);
  return m ? (m[1] === "provided" ? "provided" : "scratch") : null;
}

/**
 * Swap the node-classes section of `code` to `mode`, leaving everything else
 * (including edits) alone. Returns null if the section can't be found, e.g.
 * someone deleted its marker lines.
 */
export function applyNodeMode(
  code: string,
  lang: LanguageId,
  sig: { params: { type: string }[]; returns: string },
  mode: NodeMode,
): string | null {
  const kinds = nodeKinds(sig);
  if (!kinds.length || !nodeLang(lang)) return code;
  if (!BLOCK_RE.test(code)) return null;
  return code.replace(BLOCK_RE, () => nodeBlock(lang, kinds, mode));
}

/** Line ranges (0-based, inclusive) of the node section, for default folding. */
export function nodeBlockLines(lines: string[]): { begin: number; end: number; mode: NodeMode } | null {
  const begin = lines.findIndex((l) => /^[ \t]*(?:\/\/|#) ── Node classes \((provided|write your own)\) ──/.test(l));
  if (begin < 0) return null;
  const end = lines.findIndex((l, i) => i > begin && /^[ \t]*(?:\/\/|#) ── end node classes ──/.test(l));
  if (end < 0) return null;
  return { begin, end, mode: lines[begin].includes("(provided)") ? "provided" : "scratch" };
}

// ------------------------------------------------------------ values

const INT_RE = /^-?\d+$/;
const fitsInt = (s: string) => {
  const n = Number(s);
  return n >= -(2 ** 31) && n < 2 ** 31;
};

/** Parses what an author typed for a list/tree (JSON or space-separated) into stdin tokens. Throws a readable error. */
export function encodeNode(kind: NodeType, text: string, name: string): string {
  const t = text.trim();
  let toks: string[];
  if (t.startsWith("[")) {
    let v: unknown;
    try {
      v = JSON.parse(t);
    } catch {
      throw new Error(`${name}: that isn't valid JSON`);
    }
    if (!Array.isArray(v)) throw new Error(`${name}: expected a list like [1,2,3]`);
    toks = v.map((x) => (x === null ? "null" : String(x)));
  } else {
    toks = t ? t.split(/[\s,]+/).filter(Boolean) : [];
  }
  for (const x of toks) {
    if (x === "null") {
      if (kind === "ListNode") throw new Error(`${name}: a linked list can't contain null`);
      continue;
    }
    if (!INT_RE.test(x)) throw new Error(`${name}: expected integers${kind === "TreeNode" ? " or null" : ""}, got ${JSON.stringify(x)}`);
    if (!fitsInt(x)) throw new Error(`${name}: ${x} doesn't fit in a 32-bit integer`);
  }
  if (kind === "TreeNode") {
    while (toks.length && toks[toks.length - 1] === "null") toks.pop();
    if (toks[0] === "null") throw new Error(`${name}: the root can't be null (use [] for an empty tree)`);
    // Every value after the root must be a child of a node that exists.
    let slots = toks.length ? 2 : 0;
    for (let i = 1; i < toks.length; i++) {
      if (slots === 0) throw new Error(`${name}: value ${i + 1} has no parent (level order: children of null nodes are skipped)`);
      slots--;
      if (toks[i] !== "null") slots += 2;
    }
  }
  return toks.join(" ");
}

/** "[1,2,3]" / "[3,9,20,null,null,15,7]" from one stdin or stdout line. */
export function formatNode(line: string): string {
  const toks = line.trim() ? line.trim().split(/\s+/) : [];
  return `[${toks.join(",")}]`;
}
