import App from "../App";
import { ZOOM_LEVEL } from "../Env";
import { isKeyPressed, registerOnKeyDown, registerOnKeyUp } from "../Utils/keys";

/**
 * The class that control the events related to the keyboard.
 */
export default class KeyboardController {

    /**
     * Route Application.
     */
    private _app: App;

    constructor(app: App) {
        this._app = app;

        this.bindEvents();
    }

    /**
     * Bind on initialisation the events related to the keyboard : keypress, keydown, keyup and so on...
     * @private
     */
    private bindEvents() {
        // Global Shortcuts
        window.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
                e.preventDefault();
                this._app.projectController.openSaveWindow();
            }
        });

        registerOnKeyUp((key)=>{
            switch (key) {
                case " ": // Space bar pressed : play/pause
                    this._app.hostController.onPlayButton()
                    break
            }
        });

        registerOnKeyDown((key) => {
            const isCtrl = isKeyPressed("Control", "Meta");
            
            if (isCtrl && key === "ArrowRight") {
                this._app.editorController.zoomTo(ZOOM_LEVEL * 1.5);
            }
            if (isCtrl && key === "ArrowLeft") {
                this._app.editorController.zoomTo(ZOOM_LEVEL / 1.5);
            }
        });
    }

}