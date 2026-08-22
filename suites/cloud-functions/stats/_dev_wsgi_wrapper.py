import functions_framework
import main
import flask
try:
    app = functions_framework.create_app(main.stats_handler)  # type: ignore[attr-defined]
except Exception:
    app = flask.Flask(__name__)
    app.add_url_rule('/', endpoint='root', view_func=lambda: main.stats_handler(flask.request), methods=['GET','POST','OPTIONS'])
    app.add_url_rule('/<path:path>', endpoint='proxy', view_func=lambda path=None: main.stats_handler(flask.request), methods=['GET','POST','OPTIONS'])
