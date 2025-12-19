import App from "../App";
import ContextMenuView from "../Views/ContextMenuView";

export default class ContextMenuController {
    
    private _app: App;
    private _view: ContextMenuView;

    constructor(app: App) {
        this._app = app;
        this._view = new ContextMenuView();
        this._view.setCallback((action) => this.handleAction(action));

        this.bindEvents();
    }

    public hide() {
        this._view.hide();
    }

    private bindEvents() {
        window.addEventListener("contextmenu", (e) => {
            // Check if Shift is held. If so, let browser handle it.
            if (e.shiftKey) return;

            e.preventDefault();
            
            // Check where the click happened to customize menu if needed
            // For now, generic menu
            
            this.showMenu(e.clientX, e.clientY);
        });

        window.addEventListener("click", () => {
            if (this._view.isVisible()) {
                this._view.hide();
            }
        });

        // Also hide on scroll or resize?
        window.addEventListener("scroll", () => this.hide(), true);
    }

    private showMenu(x: number, y: number) {
        const isPianoRoll = this._app.pianoRollController.isVisible;
        const currentRegionController = this._app.regionsController;
        const currentPianoRollController = this._app.pianoRollController;

        const hasSelection = isPianoRoll ? currentPianoRollController.hasSelection() : currentRegionController.hasSelection();
        const hasClipboard = isPianoRoll ? currentPianoRollController.hasClipboard() : currentRegionController.hasClipboard();
        const hasUndo = this._app.undoManager.hasUndo();
        const hasRedo = this._app.undoManager.hasRedo();

        const items = [
            { label: "Undo", action: "undo", disabled: !hasUndo },
            { label: "Redo", action: "redo", disabled: !hasRedo },
            { label: "", action: "", separator: true },
            { label: "Cut", action: "cut", disabled: !hasSelection },
            { label: "Copy", action: "copy", disabled: !hasSelection },
            { label: "Paste", action: "paste", disabled: !hasClipboard },
            { label: "Delete", action: "delete", disabled: !hasSelection },
            { label: "", action: "", separator: true },
            { label: "Split", action: "split", disabled: isPianoRoll || !hasSelection },
            { label: "Merge", action: "merge", disabled: isPianoRoll || !hasSelection },
            { label: "", action: "", separator: true },
            { label: "Select All", action: "selectAll" },
            { label: "", action: "", separator: true },
            { label: "Default Browser Menu (Shift+Right Click)", action: "browser_menu_hint", disabled: true }
        ];
        
        this._view.show(x, y, items);
    }

    private handleAction(action: string) {
        const isPianoRoll = this._app.pianoRollController.isVisible;
        
        switch (action) {
            case "undo":
                this._app.undoManager.undo();
                break;
            case "redo":
                this._app.undoManager.redo();
                break;
            case "cut":
                if (isPianoRoll) this._app.pianoRollController.cutSelectedNotes();
                else this._app.regionsController.cutSelectedRegion();
                break;
            case "copy":
                if (isPianoRoll) this._app.pianoRollController.copySelectedNotes();
                else this._app.regionsController.copySelectedRegion();
                break;
            case "paste":
                if (isPianoRoll) this._app.pianoRollController.pasteNotes();
                else this._app.regionsController.pasteRegion(true);
                break;
            case "delete":
                if (isPianoRoll) this._app.pianoRollController.deleteSelectedNotes();
                else this._app.regionsController.deleteSelectedRegion(true);
                break;
            case "split":
                if (!isPianoRoll) this._app.regionsController.splitSelectedRegion();
                break;
            case "merge":
                if (!isPianoRoll) this._app.regionsController.mergeSelectedRegion();
                break;
            case "selectAll":
                if (isPianoRoll) this._app.pianoRollController.selectAllNotes();
                else this._app.regionsController.selectAllRegions();
                break;
        }
    }
}
