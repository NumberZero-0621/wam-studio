export default class ContextMenuView {

    private _menu: HTMLElement;
    private _callback: (action: string) => void;

    constructor() {
        this._menu = document.createElement("div");
        this._menu.className = "context-menu";
        this._menu.style.display = "none";
        this._menu.style.position = "fixed";
        this._menu.style.zIndex = "10000";
        this._menu.style.backgroundColor = "#2b2b2b";
        this._menu.style.border = "1px solid #454545";
        this._menu.style.boxShadow = "2px 2px 5px rgba(0,0,0,0.5)";
        this._menu.style.padding = "5px 0";
        this._menu.style.minWidth = "150px";
        this._menu.style.borderRadius = "4px";
        this._menu.style.fontFamily = "sans-serif";
        this._menu.style.fontSize = "13px";
        this._menu.style.color = "#e0e0e0";

        document.body.appendChild(this._menu);

        // Prevent context menu on itself
        this._menu.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    public setCallback(callback: (action: string) => void) {
        this._callback = callback;
    }

    public show(x: number, y: number, items: { label: string, action: string, separator?: boolean, disabled?: boolean }[]) {
        this._menu.innerHTML = "";
        
        items.forEach(item => {
            if (item.separator) {
                const sep = document.createElement("div");
                sep.style.height = "1px";
                sep.style.backgroundColor = "#454545";
                sep.style.margin = "4px 0";
                this._menu.appendChild(sep);
                return;
            }

            const el = document.createElement("div");
            el.innerText = item.label;
            el.style.padding = "6px 20px";
            el.style.cursor = "pointer";
            el.style.userSelect = "none";

            if (item.disabled) {
                el.style.color = "#777";
                el.style.cursor = "default";
            } else {
                el.addEventListener("mouseenter", () => {
                    el.style.backgroundColor = "#007fd4";
                    el.style.color = "#ffffff";
                });
                el.addEventListener("mouseleave", () => {
                    el.style.backgroundColor = "transparent";
                    el.style.color = "#e0e0e0";
                });
                el.addEventListener("click", (e) => {
                    e.stopPropagation(); // Prevent document click from hiding immediately? No, we want to hide.
                    // But we want to trigger action first.
                    this.hide();
                    if (this._callback) this._callback(item.action);
                });
            }

            this._menu.appendChild(el);
        });

        // Positioning logic (keep within screen)
        this._menu.style.display = "block";
        
        let posX = x;
        let posY = y;
        
        const rect = this._menu.getBoundingClientRect();
        if (posX + rect.width > window.innerWidth) {
            posX = window.innerWidth - rect.width;
        }
        if (posY + rect.height > window.innerHeight) {
            posY = window.innerHeight - rect.height;
        }
        
        this._menu.style.left = posX + "px";
        this._menu.style.top = posY + "px";
    }

    public hide() {
        this._menu.style.display = "none";
    }

    public isVisible() {
        return this._menu.style.display !== "none";
    }
}
