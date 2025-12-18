import App, { crashOnDebug } from "../App";
import { ProjectData, RegionContent } from "../Loader/Loader";

const DB_NAME = "WAMStudio_AutoSave";
const DB_VERSION = 1;
const STORE_PROJECT = "project";
const STORE_BLOBS = "blobs";
const PROJECT_KEY = "current_project";

class BlobMockXHR {
    blob: Blob;
    response: ArrayBuffer | null = null;
    responseType: string = "";
    status: number = 200;
    statusText: string = "OK";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onprogress: ((ev: ProgressEvent) => void) | null = null;

    constructor(blob: Blob) {
        this.blob = blob;
    }

    open(method: string, url: string, async: boolean) {}
    
    abort() {}

    send() {
        const reader = new FileReader();
        reader.onload = () => {
            this.response = reader.result as ArrayBuffer;
            if (this.onprogress) {
                this.onprogress({ 
                    lengthComputable: true, 
                    loaded: this.blob.size, 
                    total: this.blob.size 
                } as ProgressEvent);
            }
            if (this.onload) this.onload();
        };
        reader.onerror = () => {
            if (this.onerror) this.onerror();
        }
        reader.readAsArrayBuffer(this.blob);
    }
}

export default class AutoSaveController {
    private _app: App;
    private _db: IDBDatabase | null = null;
    private _intervalId: any;
    private _isSaving: boolean = false;

    constructor(app: App) {
        this._app = app;
    }

    public async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("AutoSaveDB error: ", request.error);
                reject(request.error);
            };

            request.onsuccess = (event) => {
                this._db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_PROJECT)) {
                    db.createObjectStore(STORE_PROJECT);
                }
                if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                    db.createObjectStore(STORE_BLOBS);
                }
            };
        });
    }

    public start() {
        // Save every 10 seconds
        this._intervalId = setInterval(() => this.save(), 10000);
        // Also save on visibility change (e.g. switching tabs/minimizing)
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.save();
            }
        });
    }

    public stop() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    public async save() {
        if (!this._db || this._isSaving) return;
        this._isSaving = true;

        try {
            // Get current project state
            const [project, contents] = await this._app.loader.saveProject();
            
            // Transaction
            const transaction = this._db.transaction([STORE_PROJECT, STORE_BLOBS], "readwrite");
            
            // Save Project Data
            const projectStore = transaction.objectStore(STORE_PROJECT);
            projectStore.put(project, PROJECT_KEY);

            // Save Blobs
            const blobStore = transaction.objectStore(STORE_BLOBS);
            // Clear old blobs first? Or just overwrite?
            // Clearing is safer to avoid orphan blobs filling up space
            await new Promise<void>((resolve, reject) => {
                const clearReq = blobStore.clear();
                clearReq.onsuccess = () => resolve();
                clearReq.onerror = () => reject(clearReq.error);
            });

            for (const content of contents) {
                blobStore.put(content.blob, content.content_name);
            }

            transaction.oncomplete = () => {
                console.log("Auto-save completed");
                this._isSaving = false;
            };

            transaction.onerror = () => {
                console.error("Auto-save failed", transaction.error);
                this._isSaving = false;
            };

        } catch (e) {
            console.error("Error during auto-save preparation", e);
            this._isSaving = false;
        }
    }

    public async restore(): Promise<boolean> {
        if (!this._db) await this.init();
        if (!this._db) return false;

        return new Promise((resolve, reject) => {
            const transaction = this._db!.transaction([STORE_PROJECT, STORE_BLOBS], "readonly");
            const projectStore = transaction.objectStore(STORE_PROJECT);
            const blobStore = transaction.objectStore(STORE_BLOBS);

            const projectReq = projectStore.get(PROJECT_KEY);

            projectReq.onsuccess = async () => {
                const projectData: ProjectData = projectReq.result;
                if (!projectData) {
                    resolve(false);
                    return;
                }

                console.log("Found auto-saved project, restoring...");

                // Load all blobs into memory for quick access during load
                // Or fetch them one by one? Fetching one by one is fine with IDB.
                // But `loadProject` uses a synchronous-looking factory but returns an async-ish XHR... 
                // We need to provide a factory function.

                const blobCache = new Map<string, Blob>();
                
                // We can't use async inside the transaction easily if we don't keep it alive.
                // Let's load all blobs names/keys first? No, let's just load everything.
                // For safety, let's load all blobs into a Map.
                
                const blobReq = blobStore.getAllKeys();
                blobReq.onsuccess = () => {
                    const keys = blobReq.result as string[];
                    let loadedCount = 0;
                    
                    if (keys.length === 0) {
                        // No blobs, just project data
                        this._app.loader.loadProject(projectData, (id) => {
                            // Should not happen if no regions
                            console.warn("Requested blob " + id + " but no blobs in autosave.");
                            return new BlobMockXHR(new Blob([])) as any;
                        }).then(() => resolve(true));
                        return;
                    }

                    keys.forEach(key => {
                        const getBlob = blobStore.get(key);
                        getBlob.onsuccess = () => {
                            blobCache.set(key, getBlob.result);
                            loadedCount++;
                            if (loadedCount === keys.length) {
                                // All blobs loaded
                                this._app.loader.loadProject(projectData, (id) => {
                                    const blob = blobCache.get(id);
                                    if (!blob) {
                                        console.error("Blob not found in autosave: " + id);
                                        return new BlobMockXHR(new Blob([])) as any;
                                    }
                                    return new BlobMockXHR(blob) as any;
                                }).then(() => resolve(true));
                            }
                        };
                    });
                };
            };
            
            projectReq.onerror = () => {
                resolve(false);
            }
        });
    }
}
