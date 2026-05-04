!function (t) {
    t.EditOnGithubPlugin = {},
    t.EditOnGithubPlugin.create = function (n, i, e) {
        function u(t) {
            return header = [
                '<div style="overflow: auto">',
                '<p style="float: right"><a style="text-decoration: underline; cursor: pointer"',
                'onclick="EditOnGithubPlugin.onClick(event)">', t,
                "</a></p>",
                "</div>"
            ].join("");
        }
        e = e || "Edit on github";
        i = i || n.replace(/\/blob\//, "/edit/");
        t.EditOnGithubPlugin.editDoc = function (t, n) {
            var e = n.route.file;
            if (e) {
                var u = i + e;
                window.open(u);
                t.preventDefault();
                return false;
            }
            return true;
        };
        return function (n, i) {
            if (t.EditOnGithubPlugin.onClick = function (t) {
                EditOnGithubPlugin.editDoc(t, i);
            }, (r = e) && "[object Function]" === {}.toString.call(r)) {
                n.afterEach(function (t) {
                    return u(e(i.route.file)) + t;
                });
            } else {
                var o = u(e);
                n.afterEach(function (t) {
                    return o + t;
                });
            }
            var r;
        };
    };
}(window);