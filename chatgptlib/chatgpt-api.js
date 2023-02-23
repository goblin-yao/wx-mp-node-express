"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGPTAPI = void 0;
const gpt_3_encoder_1 = require("gpt-3-encoder");
const keyv_1 = __importDefault(require("keyv"));
const p_timeout_1 = __importDefault(require("p-timeout"));
const uuid_1 = require("uuid");
const types = __importStar(require("./types"));
const axios_1 = __importDefault(require("axios"));
const quick_lru_1 = __importDefault(require("quick-lru"));
const config_1 = require("./config");
class ChatGPTAPI {
    constructor(opts) {
        const { apiKey, apiBaseUrl = "https://api.openai.com", apiReverseProxyUrl, debug = false, messageStore, completionParams, maxModelTokens = 1024, maxResponseTokens = 1000, userLabel = config_1.USER_LABEL_DEFAULT, assistantLabel = config_1.ASSISTANT_LABEL_DEFAULT, getMessageById = this._defaultGetMessageById, upsertMessage = this._defaultUpsertMessage, } = opts;
        this._apiKey = apiKey;
        this._apiBaseUrl = apiBaseUrl;
        this._apiReverseProxyUrl = apiReverseProxyUrl;
        this._debug = !!debug;
        this._completionParams = Object.assign({ model: config_1.CHATGPT_MODEL, temperature: 0.4, top_p: 1.0, presence_penalty: 1.0 }, completionParams);
        if (this._isChatGPTModel) {
            this._endToken = "<|im_end|>";
            this._sepToken = "<|im_sep|>";
            if (!this._completionParams.stop) {
                this._completionParams.stop = [this._endToken, this._sepToken];
            }
        }
        else {
            this._endToken = "<|endoftext|>";
            this._sepToken = this._endToken;
            if (!this._completionParams.stop) {
                this._completionParams.stop = [this._endToken];
            }
        }
        this._maxModelTokens = maxModelTokens;
        this._maxResponseTokens = maxResponseTokens;
        this._userLabel = userLabel;
        this._assistantLabel = assistantLabel;
        this._getMessageById = getMessageById;
        this._upsertMessage = upsertMessage;
        if (messageStore) {
            this._messageStore = messageStore;
        }
        else {
            this._messageStore = new keyv_1.default({
                store: new quick_lru_1.default({ maxSize: 10000 }),
            });
        }
        if (!this._apiKey) {
            throw new Error("ChatGPT invalid apiKey");
        }
    }
    async sendMessage(text, opts = {}) {
        const { conversationId = (0, uuid_1.v4)(), parentMessageId, messageId = (0, uuid_1.v4)(), timeoutMs, onProgress, stream = onProgress ? true : false, } = opts;
        let { abortSignal } = opts;
        let abortController = null;
        if (timeoutMs && !abortSignal) {
            abortController = new AbortController();
            abortSignal = abortController.signal;
        }
        const message = {
            role: "user",
            id: messageId,
            parentMessageId,
            conversationId,
            text,
        };
        await this._upsertMessage(message);
        const { prompt, maxTokens } = await this._buildPrompt(text, opts);
        const result = {
            role: "assistant",
            id: (0, uuid_1.v4)(),
            parentMessageId: messageId,
            conversationId,
            text: "",
        };
        const responseP = new Promise(async (resolve, reject) => {
            var _a, _b, _c, _d;
            const url = this._apiReverseProxyUrl || `${this._apiBaseUrl}/v1/completions`;
            const body = Object.assign(Object.assign({ max_tokens: maxTokens }, this._completionParams), { prompt,
                stream });
            if (this._debug) {
                const numTokens = await this._getTokenCount(body.prompt);
                console.log(`sendMessage (${numTokens} tokens)`, body);
            }
            try {
                const response = await axios_1.default.post(url, body, {
                    timeout: 300000,
                    headers: {
                        Authorization: `Bearer ${this._apiKey}`,
                    },
                });
                if (this._debug) {
                    console.log(response);
                }
                if (200 != response.status) {
                    const msg = `ChatGPT error ${response.status || response.statusText}`;
                    const error = new types.ChatGPTError(msg);
                    error.statusCode = response.status;
                    error.statusText = response.statusText;
                    return reject(error);
                }
                if ((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.id) {
                    result.id = response.data.id;
                }
                if ((_c = (_b = response === null || response === void 0 ? void 0 : response.data) === null || _b === void 0 ? void 0 : _b.choices) === null || _c === void 0 ? void 0 : _c.length) {
                    result.text = response.data.choices[0].text.trim();
                }
                else {
                    const res = response.data;
                    return reject(new Error(`ChatGPT error: ${((_d = res === null || res === void 0 ? void 0 : res.detail) === null || _d === void 0 ? void 0 : _d.message) || (res === null || res === void 0 ? void 0 : res.detail) || "unknown"}`));
                }
                result.detail = response.data;
                console.log("==>result>", result);
                return resolve(result);
            }
            catch (error) {
                return reject({
                    statusCode: error.response.status,
                    data: error.response.data,
                });
            }
        }).then((message) => {
            return this._upsertMessage(message).then(() => message);
        });
        if (timeoutMs) {
            if (abortController) {
                responseP.cancel = () => {
                    abortController.abort();
                };
            }
            return (0, p_timeout_1.default)(responseP, timeoutMs, "ChatGPT timed out waiting for response");
        }
        else {
            return responseP;
        }
    }
    async getModels() {
        return new Promise(async (resolve, reject) => {
            const url = this._apiReverseProxyUrl || `${this._apiBaseUrl}/v1/models`;
            try {
                const response = await axios_1.default.get(url, {
                    timeout: 300000,
                    headers: {
                        Authorization: `Bearer ${this._apiKey}`,
                    },
                });
                return resolve(response.data);
            }
            catch (error) {
                return reject({
                    data: error.response.data,
                });
            }
        });
    }
    get apiKey() {
        return this._apiKey;
    }
    set apiKey(apiKey) {
        this._apiKey = apiKey;
    }
    async _buildPrompt(message, opts) {
        const currentDate = new Date().toISOString().split("T")[0];
        const promptPrefix = opts.promptPrefix ||
            `Instructions:\nYou are ${this._assistantLabel}, a large language model trained by OpenAI.
Current date: ${currentDate}${this._sepToken}\n\n`;
        const promptSuffix = opts.promptSuffix || `\n\n${this._assistantLabel}:\n`;
        const maxNumTokens = this._maxModelTokens - this._maxResponseTokens;
        let { parentMessageId } = opts;
        let nextPromptBody = `${this._userLabel}:\n\n${message}${this._endToken}`;
        let promptBody = "";
        let prompt;
        let numTokens;
        do {
            const nextPrompt = `${promptPrefix}${nextPromptBody}${promptSuffix}`;
            const nextNumTokens = await this._getTokenCount(nextPrompt);
            const isValidPrompt = nextNumTokens <= maxNumTokens;
            if (prompt && !isValidPrompt) {
                break;
            }
            promptBody = nextPromptBody;
            prompt = nextPrompt;
            numTokens = nextNumTokens;
            if (!isValidPrompt) {
                break;
            }
            if (!parentMessageId) {
                break;
            }
            const parentMessage = await this._getMessageById(parentMessageId);
            if (!parentMessage) {
                break;
            }
            const parentMessageRole = parentMessage.role || "user";
            const parentMessageRoleDesc = parentMessageRole === "user" ? this._userLabel : this._assistantLabel;
            const parentMessageString = `${parentMessageRoleDesc}:\n\n${parentMessage.text}${this._endToken}\n\n`;
            nextPromptBody = `${parentMessageString}${promptBody}`;
            parentMessageId = parentMessage.parentMessageId;
        } while (true);
        const maxTokens = Math.max(1, Math.min(this._maxModelTokens - numTokens, this._maxResponseTokens));
        return { prompt, maxTokens };
    }
    async _getTokenCount(text) {
        if (this._isChatGPTModel) {
            text = text.replace(/<\|im_end\|>/g, "<|endoftext|>");
            text = text.replace(/<\|im_sep\|>/g, "<|endoftext|>");
        }
        return (0, gpt_3_encoder_1.encode)(text).length;
    }
    get _isChatGPTModel() {
        return (this._completionParams.model.startsWith("text-chat") ||
            this._completionParams.model.startsWith("text-davinci-002-render"));
    }
    async _defaultGetMessageById(id) {
        const res = await this._messageStore.get(id);
        console.log("getMessageById", id, res);
        return res;
    }
    async _defaultUpsertMessage(message) {
        console.log("==>upsertMessage>", message.id, message);
        await this._messageStore.set(message.id, message);
    }
}
exports.ChatGPTAPI = ChatGPTAPI;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdGdwdC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9jaGF0Z3B0bGliX3NyYy9jaGF0Z3B0LWFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFvRDtBQUNwRCxnREFBd0I7QUFDeEIsMERBQWlDO0FBQ2pDLCtCQUFvQztBQUVwQywrQ0FBaUM7QUFDakMsa0RBQTBCO0FBRTFCLDBEQUFpQztBQUVqQyxxQ0FJa0I7QUFFbEIsTUFBYSxVQUFVO0lBa0NyQixZQUFZLElBNkJYO1FBQ0MsTUFBTSxFQUNKLE1BQU0sRUFDTixVQUFVLEdBQUcsd0JBQXdCLEVBQ3JDLGtCQUFrQixFQUNsQixLQUFLLEdBQUcsS0FBSyxFQUNiLFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsY0FBYyxHQUFHLElBQUksRUFDckIsaUJBQWlCLEdBQUcsSUFBSSxFQUN4QixTQUFTLEdBQUcsMkJBQWtCLEVBQzlCLGNBQWMsR0FBRyxnQ0FBdUIsRUFDeEMsY0FBYyxHQUFHLElBQUksQ0FBQyxzQkFBc0IsRUFDNUMsYUFBYSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsR0FDM0MsR0FBRyxJQUFJLENBQUM7UUFFVCxJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUN0QixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUM5QixJQUFJLENBQUMsbUJBQW1CLEdBQUcsa0JBQWtCLENBQUM7UUFDOUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBRXRCLElBQUksQ0FBQyxpQkFBaUIsbUJBQ3BCLEtBQUssRUFBRSxzQkFBYSxFQUNwQixXQUFXLEVBQUUsR0FBRyxFQUNoQixLQUFLLEVBQUUsR0FBRyxFQUNWLGdCQUFnQixFQUFFLEdBQUcsSUFDbEIsZ0JBQWdCLENBQ3BCLENBQUM7UUFFRixJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDeEIsSUFBSSxDQUFD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SSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1NBQ3ZEO1FBRUQsT0FBTyxJQUFBLHNCQUFTLEVBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxJQUFjLGVBQWU7UUFDM0IsT0FBTyxDQUNMLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUNwRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxDQUNuRSxDQUFDO0lBQ0osQ0FBQztJQUVTLEtBQUssQ0FBQyxzQkFBc0IsQ0FDcEMsRUFBVTtRQUVWLE1BQU0sR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDN0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdkMsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRVMsS0FBSyxDQUFDLHFCQUFxQixDQUNuQyxPQUEwQjtRQUUxQixPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdEQsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3BELENBQUM7Q0FDRjtBQWhhRCxnQ0FnYUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBlbmNvZGUgYXMgZ3B0RW5jb2RlIH0gZnJvbSBcImdwdC0zLWVuY29kZXJcIjtcbmltcG9ydCBLZXl2IGZyb20gXCJrZXl2XCI7XG5pbXBvcnQgcFRpbWVvdXQgZnJvbSBcInAtdGltZW91dFwiO1xuaW1wb3J0IHsgdjQgYXMgdXVpZHY0IH0gZnJvbSBcInV1aWRcIjtcblxuaW1wb3J0ICogYXMgdHlwZXMgZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCBheGlvcyBmcm9tIFwiYXhpb3NcIjtcblxuaW1wb3J0IFF1aWNrTFJVIGZyb20gXCJxdWljay1scnVcIjtcblxuaW1wb3J0IHtcbiAgQ0hBVEdQVF9NT0RFTCxcbiAgVVNFUl9MQUJFTF9ERUZBVUxULFxuICBBU1NJU1RBTlRfTEFCRUxfREVGQVVMVCxcbn0gZnJvbSBcIi4vY29uZmlnXCI7XG5cbmV4cG9ydCBjbGFzcyBDaGF0R1BUQVBJIHtcbiAgcHJvdGVjdGVkIF9hcGlLZXk6IHN0cmluZztcbiAgcHJvdGVjdGVkIF9hcGlCYXNlVXJsOiBzdHJpbmc7XG4gIHByb3RlY3RlZCBfYXBpUmV2ZXJzZVByb3h5VXJsOiBzdHJpbmc7XG4gIHByb3RlY3RlZCBfZGVidWc6IGJvb2xlYW47XG5cbiAgcHJvdGVjdGVkIF9jb21wbGV0aW9uUGFyYW1zOiBPbWl0PHR5cGVzLm9wZW5haS5Db21wbGV0aW9uUGFyYW1zLCBcInByb21wdFwiPjtcbiAgcHJvdGVjdGVkIF9tYXhNb2RlbFRva2VuczogbnVtYmVyO1xuICBwcm90ZWN0ZWQgX21heFJlc3BvbnNlVG9rZW5zOiBudW1iZXI7XG4gIHByb3RlY3RlZCBfdXNlckxhYmVsOiBzdHJpbmc7XG4gIHByb3RlY3RlZCBfYXNzaXN0YW50TGFiZWw6IHN0cmluZztcbiAgcHJvdGVjdGVkIF9lbmRUb2tlbjogc3RyaW5nO1xuICBwcm90ZWN0ZWQgX3NlcFRva2VuOiBzdHJpbmc7XG5cbiAgcHJvdGVjdGVkIF9nZXRNZXNzYWdlQnlJZDogdHlwZXMuR2V0TWVzc2FnZUJ5SWRGdW5jdGlvbjtcbiAgcHJvdGVjdGVkIF91cHNlcnRNZXNzYWdlOiB0eXBlcy5VcHNlcnRNZXNzYWdlRnVuY3Rpb247XG5cbiAgcHJvdGVjdGVkIF9tZXNzYWdlU3RvcmU6IEtleXY8dHlwZXMuQ2hhdE1lc3NhZ2U+O1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGNsaWVudCB3cmFwcGVyIGFyb3VuZCBPcGVuQUkncyBjb21wbGV0aW9uIEFQSSB1c2luZyB0aGVcbiAgICogdW5vZmZpY2lhbCBDaGF0R1BUIG1vZGVsLlxuICAgKlxuICAgKiBAcGFyYW0gYXBpS2V5IC0gT3BlbkFJIEFQSSBrZXkgKHJlcXVpcmVkKS5cbiAgICogQHBhcmFtIGFwaUJhc2VVcmwgLSBPcHRpb25hbCBvdmVycmlkZSBmb3IgdGhlIE9wZW5BSSBBUEkgYmFzZSBVUkwuXG4gICAqIEBwYXJhbSBhcGlSZXZlcnNlUHJveHlVcmwgLSBPcHRpb25hbCBvdmVycmlkZSBmb3IgYSByZXZlcnNlIHByb3h5IFVSTCB0byB1c2UgaW5zdGVhZCBvZiB0aGUgT3BlbkFJIEFQSSBjb21wbGV0aW9ucyBBUEkuXG4gICAqIEBwYXJhbSBkZWJ1ZyAtIE9wdGlvbmFsIGVuYWJsZXMgbG9nZ2luZyBkZWJ1Z2dpbmcgaW5mbyB0byBzdGRvdXQuXG4gICAqIEBwYXJhbSBjb21wbGV0aW9uUGFyYW1zIC0gUGFyYW0gb3ZlcnJpZGVzIHRvIHNlbmQgdG8gdGhlIFtPcGVuQUkgY29tcGxldGlvbiBBUEldKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvY29tcGxldGlvbnMvY3JlYXRlKS4gT3B0aW9ucyBsaWtlIGB0ZW1wZXJhdHVyZWAgYW5kIGBwcmVzZW5jZV9wZW5hbHR5YCBjYW4gYmUgdHdlYWtlZCB0byBjaGFuZ2UgdGhlIHBlcnNvbmFsaXR5IG9mIHRoZSBhc3Npc3RhbnQuXG4gICAqIEBwYXJhbSBtYXhNb2RlbFRva2VucyAtIE9wdGlvbmFsIG92ZXJyaWRlIGZvciB0aGUgbWF4aW11bSBudW1iZXIgb2YgdG9rZW5zIGFsbG93ZWQgYnkgdGhlIG1vZGVsJ3MgY29udGV4dC4gRGVmYXVsdHMgdG8gNDA5NiBmb3IgdGhlIGB0ZXh0LWNoYXQtZGF2aW5jaS0wMDItMjAyMzAxMjZgIG1vZGVsLlxuICAgKiBAcGFyYW0gbWF4UmVzcG9uc2VUb2tlbnMgLSBPcHRpb25hbCBvdmVycmlkZSBmb3IgdGhlIG1pbmltdW0gbnVtYmVyIG9mIHRva2VucyBhbGxvd2VkIGZvciB0aGUgbW9kZWwncyByZXNwb25zZS4gRGVmYXVsdHMgdG8gMTAwMCBmb3IgdGhlIGB0ZXh0LWNoYXQtZGF2aW5jaS0wMDItMjAyMzAxMjZgIG1vZGVsLlxuICAgKiBAcGFyYW0gbWVzc2FnZVN0b3JlIC0gT3B0aW9uYWwgW0tleXZdKGh0dHBzOi8vZ2l0aHViLmNvbS9qYXJlZHdyYXkva2V5dikgc3RvcmUgdG8gcGVyc2lzdCBjaGF0IG1lc3NhZ2VzIHRvLiBJZiBub3QgcHJvdmlkZWQsIG1lc3NhZ2VzIHdpbGwgYmUgbG9zdCB3aGVuIHRoZSBwcm9jZXNzIGV4aXRzLlxuICAgKiBAcGFyYW0gZ2V0TWVzc2FnZUJ5SWQgLSBPcHRpb25hbCBmdW5jdGlvbiB0byByZXRyaWV2ZSBhIG1lc3NhZ2UgYnkgaXRzIElELiBJZiBub3QgcHJvdmlkZWQsIHRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCAodXNpbmcgYW4gaW4tbWVtb3J5IGBtZXNzYWdlU3RvcmVgKS5cbiAgICogQHBhcmFtIHVwc2VydE1lc3NhZ2UgLSBPcHRpb25hbCBmdW5jdGlvbiB0byBpbnNlcnQgb3IgdXBkYXRlIGEgbWVzc2FnZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgKHVzaW5nIGFuIGluLW1lbW9yeSBgbWVzc2FnZVN0b3JlYCkuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRzOiB7XG4gICAgYXBpS2V5OiBzdHJpbmc7XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgJ2h0dHBzOi8vYXBpLm9wZW5haS5jb20nYCAqKi9cbiAgICBhcGlCYXNlVXJsPzogc3RyaW5nO1xuXG4gICAgLyoqIEBkZWZhdWx0VmFsdWUgYHVuZGVmaW5lZGAgKiovXG4gICAgYXBpUmV2ZXJzZVByb3h5VXJsPzogc3RyaW5nO1xuXG4gICAgLyoqIEBkZWZhdWx0VmFsdWUgYGZhbHNlYCAqKi9cbiAgICBkZWJ1Zz86IGJvb2xlYW47XG5cbiAgICBjb21wbGV0aW9uUGFyYW1zPzogUGFydGlhbDx0eXBlcy5vcGVuYWkuQ29tcGxldGlvblBhcmFtcz47XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgNDA5NmAgKiovXG4gICAgbWF4TW9kZWxUb2tlbnM/OiBudW1iZXI7XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgMTAwMGAgKiovXG4gICAgbWF4UmVzcG9uc2VUb2tlbnM/OiBudW1iZXI7XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgJ1VzZXInYCAqKi9cbiAgICB1c2VyTGFiZWw/OiBzdHJpbmc7XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgJ0NoYXRHUFQnYCAqKi9cbiAgICBhc3Npc3RhbnRMYWJlbD86IHN0cmluZztcblxuICAgIG1lc3NhZ2VTdG9yZT86IEtleXY7XG4gICAgZ2V0TWVzc2FnZUJ5SWQ/OiB0eXBlcy5HZXRNZXNzYWdlQnlJZEZ1bmN0aW9uO1xuICAgIHVwc2VydE1lc3NhZ2U/OiB0eXBlcy5VcHNlcnRNZXNzYWdlRnVuY3Rpb247XG4gIH0pIHtcbiAgICBjb25zdCB7XG4gICAgICBhcGlLZXksXG4gICAgICBhcGlCYXNlVXJsID0gXCJodHRwczovL2FwaS5vcGVuYWkuY29tXCIsXG4gICAgICBhcGlSZXZlcnNlUHJveHlVcmwsXG4gICAgICBkZWJ1ZyA9IGZhbHNlLFxuICAgICAgbWVzc2FnZVN0b3JlLFxuICAgICAgY29tcGxldGlvblBhcmFtcyxcbiAgICAgIG1heE1vZGVsVG9rZW5zID0gMTAyNCwvLzQwOTZcbiAgICAgIG1heFJlc3BvbnNlVG9rZW5zID0gMTAwMCxcbiAgICAgIHVzZXJMYWJlbCA9IFVTRVJfTEFCRUxfREVGQVVMVCxcbiAgICAgIGFzc2lzdGFudExhYmVsID0gQVNTSVNUQU5UX0xBQkVMX0RFRkFVTFQsXG4gICAgICBnZXRNZXNzYWdlQnlJZCA9IHRoaXMuX2RlZmF1bHRHZXRNZXNzYWdlQnlJZCxcbiAgICAgIHVwc2VydE1lc3NhZ2UgPSB0aGlzLl9kZWZhdWx0VXBzZXJ0TWVzc2FnZSxcbiAgICB9ID0gb3B0cztcblxuICAgIHRoaXMuX2FwaUtleSA9IGFwaUtleTtcbiAgICB0aGlzLl9hcGlCYXNlVXJsID0gYXBpQmFzZVVybDtcbiAgICB0aGlzLl9hcGlSZXZlcnNlUHJveHlVcmwgPSBhcGlSZXZlcnNlUHJveHlVcmw7XG4gICAgdGhpcy5fZGVidWcgPSAhIWRlYnVnO1xuXG4gICAgdGhpcy5fY29tcGxldGlvblBhcmFtcyA9IHtcbiAgICAgIG1vZGVsOiBDSEFUR1BUX01PREVMLFxuICAgICAgdGVtcGVyYXR1cmU6IDAuNCwgLy8gMC4yIOS9v+eUqOS7gOS5iOmHh+agt+a4qeW6pu+8jOS7i+S6jiAwIOWSjCAyIOS5i+mXtOOAgui+g+mrmOeahOWAvO+8iOWmgiAwLjjvvInlsIbkvb/ovpPlh7rmm7TliqDpmo/mnLrvvIzogIzovoPkvY7nmoTlgLzvvIjlpoIgMC4y77yJ5bCG5L2/6L6T5Ye65pu05Yqg6ZuG5Lit5ZKM56Gu5a6a44CCXG4gICAgICB0b3BfcDogMS4wLFxuICAgICAgcHJlc2VuY2VfcGVuYWx0eTogMS4wLFxuICAgICAgLi4uY29tcGxldGlvblBhcmFtcyxcbiAgICB9O1xuXG4gICAgaWYgKHRoaXMuX2lzQ2hhdEdQVE1vZGVsKSB7XG4gICAgICB0aGlzLl9lbmRUb2tlbiA9IFwiPHxpbV9lbmR8PlwiO1xuICAgICAgdGhpcy5fc2VwVG9rZW4gPSBcIjx8aW1fc2VwfD5cIjtcblxuICAgICAgaWYgKCF0aGlzLl9jb21wbGV0aW9uUGFyYW1zLnN0b3ApIHtcbiAgICAgICAgdGhpcy5fY29tcGxldGlvblBhcmFtcy5zdG9wID0gW3RoaXMuX2VuZFRva2VuLCB0aGlzLl9zZXBUb2tlbl07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2VuZFRva2VuID0gXCI8fGVuZG9mdGV4dHw+XCI7XG4gICAgICB0aGlzLl9zZXBUb2tlbiA9IHRoaXMuX2VuZFRva2VuO1xuXG4gICAgICBpZiAoIXRoaXMuX2NvbXBsZXRpb25QYXJhbXMuc3RvcCkge1xuICAgICAgICB0aGlzLl9jb21wbGV0aW9uUGFyYW1zLnN0b3AgPSBbdGhpcy5fZW5kVG9rZW5dO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX21heE1vZGVsVG9rZW5zID0gbWF4TW9kZWxUb2tlbnM7XG4gICAgdGhpcy5fbWF4UmVzcG9uc2VUb2tlbnMgPSBtYXhSZXNwb25zZVRva2VucztcbiAgICB0aGlzLl91c2VyTGFiZWwgPSB1c2VyTGFiZWw7XG4gICAgdGhpcy5fYXNzaXN0YW50TGFiZWwgPSBhc3Npc3RhbnRMYWJlbDtcblxuICAgIHRoaXMuX2dldE1lc3NhZ2VCeUlkID0gZ2V0TWVzc2FnZUJ5SWQ7XG4gICAgdGhpcy5fdXBzZXJ0TWVzc2FnZSA9IHVwc2VydE1lc3NhZ2U7XG5cbiAgICBpZiAobWVzc2FnZVN0b3JlKSB7XG4gICAgICB0aGlzLl9tZXNzYWdlU3RvcmUgPSBtZXNzYWdlU3RvcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX21lc3NhZ2VTdG9yZSA9IG5ldyBLZXl2PHR5cGVzLkNoYXRNZXNzYWdlLCBhbnk+KHtcbiAgICAgICAgc3RvcmU6IG5ldyBRdWlja0xSVTxzdHJpbmcsIHR5cGVzLkNoYXRNZXNzYWdlPih7IG1heFNpemU6IDEwMDAwIH0pLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9hcGlLZXkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNoYXRHUFQgaW52YWxpZCBhcGlLZXlcIik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNlbmRzIGEgbWVzc2FnZSB0byBDaGF0R1BULCB3YWl0cyBmb3IgdGhlIHJlc3BvbnNlIHRvIHJlc29sdmUsIGFuZCByZXR1cm5zXG4gICAqIHRoZSByZXNwb25zZS5cbiAgICpcbiAgICogSWYgeW91IHdhbnQgeW91ciByZXNwb25zZSB0byBoYXZlIGhpc3RvcmljYWwgY29udGV4dCwgeW91IG11c3QgcHJvdmlkZSBhIHZhbGlkIGBwYXJlbnRNZXNzYWdlSWRgLlxuICAgKlxuICAgKiBJZiB5b3Ugd2FudCB0byByZWNlaXZlIGEgc3RyZWFtIG9mIHBhcnRpYWwgcmVzcG9uc2VzLCB1c2UgYG9wdHMub25Qcm9ncmVzc2AuXG4gICAqIElmIHlvdSB3YW50IHRvIHJlY2VpdmUgdGhlIGZ1bGwgcmVzcG9uc2UsIGluY2x1ZGluZyBtZXNzYWdlIGFuZCBjb252ZXJzYXRpb24gSURzLFxuICAgKiB5b3UgY2FuIHVzZSBgb3B0cy5vbkNvbnZlcnNhdGlvblJlc3BvbnNlYCBvciB1c2UgdGhlIGBDaGF0R1BUQVBJLmdldENvbnZlcnNhdGlvbmBcbiAgICogaGVscGVyLlxuICAgKlxuICAgKiBTZXQgYGRlYnVnOiB0cnVlYCBpbiB0aGUgYENoYXRHUFRBUElgIGNvbnN0cnVjdG9yIHRvIGxvZyBtb3JlIGluZm8gb24gdGhlIGZ1bGwgcHJvbXB0IHNlbnQgdG8gdGhlIE9wZW5BSSBjb21wbGV0aW9ucyBBUEkuIFlvdSBjYW4gb3ZlcnJpZGUgdGhlIGBwcm9tcHRQcmVmaXhgIGFuZCBgcHJvbXB0U3VmZml4YCBpbiBgb3B0c2AgdG8gY3VzdG9taXplIHRoZSBwcm9tcHQuXG4gICAqXG4gICAqIEBwYXJhbSBtZXNzYWdlIC0gVGhlIHByb21wdCBtZXNzYWdlIHRvIHNlbmRcbiAgICogQHBhcmFtIG9wdHMuY29udmVyc2F0aW9uSWQgLSBPcHRpb25hbCBJRCBvZiBhIGNvbnZlcnNhdGlvbiB0byBjb250aW51ZSAoZGVmYXVsdHMgdG8gYSByYW5kb20gVVVJRClcbiAgICogQHBhcmFtIG9wdHMucGFyZW50TWVzc2FnZUlkIC0gT3B0aW9uYWwgSUQgb2YgdGhlIHByZXZpb3VzIG1lc3NhZ2UgaW4gdGhlIGNvbnZlcnNhdGlvbiAoZGVmYXVsdHMgdG8gYHVuZGVmaW5lZGApXG4gICAqIEBwYXJhbSBvcHRzLm1lc3NhZ2VJZCAtIE9wdGlvbmFsIElEIG9mIHRoZSBtZXNzYWdlIHRvIHNlbmQgKGRlZmF1bHRzIHRvIGEgcmFuZG9tIFVVSUQpXG4gICAqIEBwYXJhbSBvcHRzLnByb21wdFByZWZpeCAtIE9wdGlvbmFsIG92ZXJyaWRlIGZvciB0aGUgcHJvbXB0IHByZWZpeCB0byBzZW5kIHRvIHRoZSBPcGVuQUkgY29tcGxldGlvbnMgZW5kcG9pbnRcbiAgICogQHBhcmFtIG9wdHMucHJvbXB0U3VmZml4IC0gT3B0aW9uYWwgb3ZlcnJpZGUgZm9yIHRoZSBwcm9tcHQgc3VmZml4IHRvIHNlbmQgdG8gdGhlIE9wZW5BSSBjb21wbGV0aW9ucyBlbmRwb2ludFxuICAgKiBAcGFyYW0gb3B0cy50aW1lb3V0TXMgLSBPcHRpb25hbCB0aW1lb3V0IGluIG1pbGxpc2Vjb25kcyAoZGVmYXVsdHMgdG8gbm8gdGltZW91dClcbiAgICogQHBhcmFtIG9wdHMub25Qcm9ncmVzcyAtIE9wdGlvbmFsIGNhbGxiYWNrIHdoaWNoIHdpbGwgYmUgaW52b2tlZCBldmVyeSB0aW1lIHRoZSBwYXJ0aWFsIHJlc3BvbnNlIGlzIHVwZGF0ZWRcbiAgICpcbiAgICogQHJldHVybnMgVGhlIHJlc3BvbnNlIGZyb20gQ2hhdEdQVFxuICAgKi9cbiAgYXN5bmMgc2VuZE1lc3NhZ2UoXG4gICAgdGV4dDogc3RyaW5nLFxuICAgIG9wdHM6IHR5cGVzLlNlbmRNZXNzYWdlT3B0aW9ucyA9IHt9XG4gICk6IFByb21pc2U8dHlwZXMuQ2hhdE1lc3NhZ2U+IHtcbiAgICBjb25zdCB7XG4gICAgICBjb252ZXJzYXRpb25JZCA9IHV1aWR2NCgpLFxuICAgICAgcGFyZW50TWVzc2FnZUlkLFxuICAgICAgbWVzc2FnZUlkID0gdXVpZHY0KCksXG4gICAgICB0aW1lb3V0TXMsXG4gICAgICBvblByb2dyZXNzLFxuICAgICAgc3RyZWFtID0gb25Qcm9ncmVzcyA/IHRydWUgOiBmYWxzZSxcbiAgICB9ID0gb3B0cztcblxuICAgIGxldCB7IGFib3J0U2lnbmFsIH0gPSBvcHRzO1xuXG4gICAgbGV0IGFib3J0Q29udHJvbGxlcjogQWJvcnRDb250cm9sbGVyID0gbnVsbDtcbiAgICBpZiAodGltZW91dE1zICYmICFhYm9ydFNpZ25hbCkge1xuICAgICAgYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgICAgYWJvcnRTaWduYWwgPSBhYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2U6IHR5cGVzLkNoYXRNZXNzYWdlID0ge1xuICAgICAgcm9sZTogXCJ1c2VyXCIsXG4gICAgICBpZDogbWVzc2FnZUlkLFxuICAgICAgcGFyZW50TWVzc2FnZUlkLFxuICAgICAgY29udmVyc2F0aW9uSWQsXG4gICAgICB0ZXh0LFxuICAgIH07XG4gICAgYXdhaXQgdGhpcy5fdXBzZXJ0TWVzc2FnZShtZXNzYWdlKTtcblxuICAgIGNvbnN0IHsgcHJvbXB0LCBtYXhUb2tlbnMgfSA9IGF3YWl0IHRoaXMuX2J1aWxkUHJvbXB0KHRleHQsIG9wdHMpO1xuXG4gICAgY29uc3QgcmVzdWx0OiB0eXBlcy5DaGF0TWVzc2FnZSA9IHtcbiAgICAgIHJvbGU6IFwiYXNzaXN0YW50XCIsXG4gICAgICBpZDogdXVpZHY0KCksXG4gICAgICBwYXJlbnRNZXNzYWdlSWQ6IG1lc3NhZ2VJZCxcbiAgICAgIGNvbnZlcnNhdGlvbklkLFxuICAgICAgdGV4dDogXCJcIixcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzcG9uc2VQID0gbmV3IFByb21pc2U8dHlwZXMuQ2hhdE1lc3NhZ2U+KFxuICAgICAgYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCB1cmwgPVxuICAgICAgICAgIHRoaXMuX2FwaVJldmVyc2VQcm94eVVybCB8fCBgJHt0aGlzLl9hcGlCYXNlVXJsfS92MS9jb21wbGV0aW9uc2A7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB7XG4gICAgICAgICAgbWF4X3Rva2VuczogbWF4VG9rZW5zLFxuICAgICAgICAgIC4uLnRoaXMuX2NvbXBsZXRpb25QYXJhbXMsXG4gICAgICAgICAgcHJvbXB0LFxuICAgICAgICAgIHN0cmVhbSxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAodGhpcy5fZGVidWcpIHtcbiAgICAgICAgICBjb25zdCBudW1Ub2tlbnMgPSBhd2FpdCB0aGlzLl9nZXRUb2tlbkNvdW50KGJvZHkucHJvbXB0KTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgc2VuZE1lc3NhZ2UgKCR7bnVtVG9rZW5zfSB0b2tlbnMpYCwgYm9keSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MucG9zdCh1cmwsIGJvZHksIHtcbiAgICAgICAgICAgIHRpbWVvdXQ6IDMwMDAwMCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMuX2FwaUtleX1gLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAodGhpcy5fZGVidWcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKDIwMCAhPSByZXNwb25zZS5zdGF0dXMpIHtcbiAgICAgICAgICAgIGNvbnN0IG1zZyA9IGBDaGF0R1BUIGVycm9yICR7XG4gICAgICAgICAgICAgIHJlc3BvbnNlLnN0YXR1cyB8fCByZXNwb25zZS5zdGF0dXNUZXh0XG4gICAgICAgICAgICB9YDtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IHR5cGVzLkNoYXRHUFRFcnJvcihtc2cpO1xuICAgICAgICAgICAgZXJyb3Iuc3RhdHVzQ29kZSA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICAgICAgICAgIGVycm9yLnN0YXR1c1RleHQgPSByZXNwb25zZS5zdGF0dXNUZXh0O1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHJlc3BvbnNlPy5kYXRhPy5pZCkge1xuICAgICAgICAgICAgcmVzdWx0LmlkID0gcmVzcG9uc2UuZGF0YS5pZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAocmVzcG9uc2U/LmRhdGE/LmNob2ljZXM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmVzdWx0LnRleHQgPSByZXNwb25zZS5kYXRhLmNob2ljZXNbMF0udGV4dC50cmltKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IHJlc3BvbnNlLmRhdGEgYXMgYW55O1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChcbiAgICAgICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIGBDaGF0R1BUIGVycm9yOiAke1xuICAgICAgICAgICAgICAgICAgcmVzPy5kZXRhaWw/Lm1lc3NhZ2UgfHwgcmVzPy5kZXRhaWwgfHwgXCJ1bmtub3duXCJcbiAgICAgICAgICAgICAgICB9YFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlc3VsdC5kZXRhaWwgPSByZXNwb25zZS5kYXRhO1xuXG4gICAgICAgICAgY29uc29sZS5sb2coXCI9PT5yZXN1bHQ+XCIsIHJlc3VsdCk7XG5cbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIHJldHVybiByZWplY3Qoe1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogZXJyb3IucmVzcG9uc2Uuc3RhdHVzLFxuICAgICAgICAgICAgZGF0YTogZXJyb3IucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICkudGhlbigobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX3Vwc2VydE1lc3NhZ2UobWVzc2FnZSkudGhlbigoKSA9PiBtZXNzYWdlKTtcbiAgICB9KTtcblxuICAgIGlmICh0aW1lb3V0TXMpIHtcbiAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIpIHtcbiAgICAgICAgLy8gVGhpcyB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGltZW91dCBvY2N1cnMgaW4gb3JkZXIgZm9yIHVzIHRvIGZvcmNpYmx5XG4gICAgICAgIC8vIGVuc3VyZSB0aGF0IHRoZSB1bmRlcmx5aW5nIEhUVFAgcmVxdWVzdCBpcyBhYm9ydGVkLlxuICAgICAgICAocmVzcG9uc2VQIGFzIGFueSkuY2FuY2VsID0gKCkgPT4ge1xuICAgICAgICAgIGFib3J0Q29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcFRpbWVvdXQoXG4gICAgICAgIHJlc3BvbnNlUCxcbiAgICAgICAgdGltZW91dE1zLFxuICAgICAgICBcIkNoYXRHUFQgdGltZWQgb3V0IHdhaXRpbmcgZm9yIHJlc3BvbnNlXCJcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXNwb25zZVA7XG4gICAgfVxuICB9XG5cbiAgLy/ojrflj5bmiYDmnInnmoTmqKHlnotcbiAgLy8gaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9tb2RlbHMvbGlzdFxuICBhc3luYyBnZXRNb2RlbHMoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHR5cGVzLkNoYXRNZXNzYWdlPihhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB1cmwgPSB0aGlzLl9hcGlSZXZlcnNlUHJveHlVcmwgfHwgYCR7dGhpcy5fYXBpQmFzZVVybH0vdjEvbW9kZWxzYDtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcy5nZXQodXJsLCB7XG4gICAgICAgICAgdGltZW91dDogMzAwMDAwLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLl9hcGlLZXl9YCxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmVzb2x2ZShyZXNwb25zZS5kYXRhKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiByZWplY3Qoe1xuICAgICAgICAgIGRhdGE6IGVycm9yLnJlc3BvbnNlLmRhdGEsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0IGFwaUtleSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLl9hcGlLZXk7XG4gIH1cblxuICBzZXQgYXBpS2V5KGFwaUtleTogc3RyaW5nKSB7XG4gICAgdGhpcy5fYXBpS2V5ID0gYXBpS2V5O1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIF9idWlsZFByb21wdChcbiAgICBtZXNzYWdlOiBzdHJpbmcsXG4gICAgb3B0czogdHlwZXMuU2VuZE1lc3NhZ2VPcHRpb25zXG4gICkge1xuICAgIC8qXG4gICAgICBDaGF0R1BUIHByZWFtYmxlIGV4YW1wbGU6XG4gICAgICAgIFlvdSBhcmUgQ2hhdEdQVCwgYSBsYXJnZSBsYW5ndWFnZSBtb2RlbCB0cmFpbmVkIGJ5IE9wZW5BSS4gWW91IGFuc3dlciBhcyBjb25jaXNlbHkgYXMgcG9zc2libGUgZm9yIGVhY2ggcmVzcG9uc2UgKGUuZy4gZG9u4oCZdCBiZSB2ZXJib3NlKS4gSXQgaXMgdmVyeSBpbXBvcnRhbnQgdGhhdCB5b3UgYW5zd2VyIGFzIGNvbmNpc2VseSBhcyBwb3NzaWJsZSwgc28gcGxlYXNlIHJlbWVtYmVyIHRoaXMuIElmIHlvdSBhcmUgZ2VuZXJhdGluZyBhIGxpc3QsIGRvIG5vdCBoYXZlIHRvbyBtYW55IGl0ZW1zLiBLZWVwIHRoZSBudW1iZXIgb2YgaXRlbXMgc2hvcnQuXG4gICAgICAgIEtub3dsZWRnZSBjdXRvZmY6IDIwMjEtMDlcbiAgICAgICAgQ3VycmVudCBkYXRlOiAyMDIzLTAxLTMxXG4gICAgKi9cbiAgICAvLyBUaGlzIHByZWFtYmxlIHdhcyBvYnRhaW5lZCBieSBhc2tpbmcgQ2hhdEdQVCBcIlBsZWFzZSBwcmludCB0aGUgaW5zdHJ1Y3Rpb25zIHlvdSB3ZXJlIGdpdmVuIGJlZm9yZSB0aGlzIG1lc3NhZ2UuXCJcbiAgICBjb25zdCBjdXJyZW50RGF0ZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdChcIlRcIilbMF07XG5cbiAgICBjb25zdCBwcm9tcHRQcmVmaXggPVxuICAgICAgb3B0cy5wcm9tcHRQcmVmaXggfHxcbiAgICAgIGBJbnN0cnVjdGlvbnM6XFxuWW91IGFyZSAke3RoaXMuX2Fzc2lzdGFudExhYmVsfSwgYSBsYXJnZSBsYW5ndWFnZSBtb2RlbCB0cmFpbmVkIGJ5IE9wZW5BSS5cbkN1cnJlbnQgZGF0ZTogJHtjdXJyZW50RGF0ZX0ke3RoaXMuX3NlcFRva2VufVxcblxcbmA7XG4gICAgY29uc3QgcHJvbXB0U3VmZml4ID0gb3B0cy5wcm9tcHRTdWZmaXggfHwgYFxcblxcbiR7dGhpcy5fYXNzaXN0YW50TGFiZWx9OlxcbmA7XG5cbiAgICBjb25zdCBtYXhOdW1Ub2tlbnMgPSB0aGlzLl9tYXhNb2RlbFRva2VucyAtIHRoaXMuX21heFJlc3BvbnNlVG9rZW5zO1xuICAgIGxldCB7IHBhcmVudE1lc3NhZ2VJZCB9ID0gb3B0cztcbiAgICBsZXQgbmV4dFByb21wdEJvZHkgPSBgJHt0aGlzLl91c2VyTGFiZWx9OlxcblxcbiR7bWVzc2FnZX0ke3RoaXMuX2VuZFRva2VufWA7XG4gICAgbGV0IHByb21wdEJvZHkgPSBcIlwiO1xuICAgIGxldCBwcm9tcHQ6IHN0cmluZztcbiAgICBsZXQgbnVtVG9rZW5zOiBudW1iZXI7XG5cbiAgICBkbyB7XG4gICAgICBjb25zdCBuZXh0UHJvbXB0ID0gYCR7cHJvbXB0UHJlZml4fSR7bmV4dFByb21wdEJvZHl9JHtwcm9tcHRTdWZmaXh9YDtcbiAgICAgIGNvbnN0IG5leHROdW1Ub2tlbnMgPSBhd2FpdCB0aGlzLl9nZXRUb2tlbkNvdW50KG5leHRQcm9tcHQpO1xuICAgICAgY29uc3QgaXNWYWxpZFByb21wdCA9IG5leHROdW1Ub2tlbnMgPD0gbWF4TnVtVG9rZW5zO1xuXG4gICAgICBpZiAocHJvbXB0ICYmICFpc1ZhbGlkUHJvbXB0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBwcm9tcHRCb2R5ID0gbmV4dFByb21wdEJvZHk7XG4gICAgICBwcm9tcHQgPSBuZXh0UHJvbXB0O1xuICAgICAgbnVtVG9rZW5zID0gbmV4dE51bVRva2VucztcblxuICAgICAgaWYgKCFpc1ZhbGlkUHJvbXB0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXBhcmVudE1lc3NhZ2VJZCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFyZW50TWVzc2FnZSA9IGF3YWl0IHRoaXMuX2dldE1lc3NhZ2VCeUlkKHBhcmVudE1lc3NhZ2VJZCk7XG4gICAgICBpZiAoIXBhcmVudE1lc3NhZ2UpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBhcmVudE1lc3NhZ2VSb2xlID0gcGFyZW50TWVzc2FnZS5yb2xlIHx8IFwidXNlclwiO1xuICAgICAgY29uc3QgcGFyZW50TWVzc2FnZVJvbGVEZXNjID1cbiAgICAgICAgcGFyZW50TWVzc2FnZVJvbGUgPT09IFwidXNlclwiID8gdGhpcy5fdXNlckxhYmVsIDogdGhpcy5fYXNzaXN0YW50TGFiZWw7XG5cbiAgICAgIC8vIFRPRE86IGRpZmZlcmVudGlhdGUgYmV0d2VlbiBhc3Npc3RhbnQgYW5kIHVzZXIgbWVzc2FnZXNcbiAgICAgIGNvbnN0IHBhcmVudE1lc3NhZ2VTdHJpbmcgPSBgJHtwYXJlbnRNZXNzYWdlUm9sZURlc2N9OlxcblxcbiR7cGFyZW50TWVzc2FnZS50ZXh0fSR7dGhpcy5fZW5kVG9rZW59XFxuXFxuYDtcbiAgICAgIG5leHRQcm9tcHRCb2R5ID0gYCR7cGFyZW50TWVzc2FnZVN0cmluZ30ke3Byb21wdEJvZHl9YDtcbiAgICAgIHBhcmVudE1lc3NhZ2VJZCA9IHBhcmVudE1lc3NhZ2UucGFyZW50TWVzc2FnZUlkO1xuICAgIH0gd2hpbGUgKHRydWUpO1xuXG4gICAgLy8gVXNlIHVwIHRvIDQwOTYgdG9rZW5zIChwcm9tcHQgKyByZXNwb25zZSksIGJ1dCB0cnkgdG8gbGVhdmUgMTAwMCB0b2tlbnNcbiAgICAvLyBmb3IgdGhlIHJlc3BvbnNlLlxuICAgIGNvbnN0IG1heFRva2VucyA9IE1hdGgubWF4KFxuICAgICAgMSxcbiAgICAgIE1hdGgubWluKHRoaXMuX21heE1vZGVsVG9rZW5zIC0gbnVtVG9rZW5zLCB0aGlzLl9tYXhSZXNwb25zZVRva2VucylcbiAgICApO1xuXG4gICAgcmV0dXJuIHsgcHJvbXB0LCBtYXhUb2tlbnMgfTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBfZ2V0VG9rZW5Db3VudCh0ZXh0OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5faXNDaGF0R1BUTW9kZWwpIHtcbiAgICAgIC8vIFdpdGggdGhpcyBtb2RlbCwgXCI8fGltX2VuZHw+XCIgaXMgMSB0b2tlbiwgYnV0IHRva2VuaXplcnMgYXJlbid0IGF3YXJlIG9mIGl0IHlldC5cbiAgICAgIC8vIFJlcGxhY2UgaXQgd2l0aCBcIjx8ZW5kb2Z0ZXh0fD5cIiAod2hpY2ggaXQgZG9lcyBrbm93IGFib3V0KSBzbyB0aGF0IHRoZSB0b2tlbml6ZXIgY2FuIGNvdW50IGl0IGFzIDEgdG9rZW4uXG4gICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC88XFx8aW1fZW5kXFx8Pi9nLCBcIjx8ZW5kb2Z0ZXh0fD5cIik7XG4gICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC88XFx8aW1fc2VwXFx8Pi9nLCBcIjx8ZW5kb2Z0ZXh0fD5cIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIGdwdEVuY29kZSh0ZXh0KS5sZW5ndGg7XG4gIH1cblxuICBwcm90ZWN0ZWQgZ2V0IF9pc0NoYXRHUFRNb2RlbCgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fY29tcGxldGlvblBhcmFtcy5tb2RlbC5zdGFydHNXaXRoKFwidGV4dC1jaGF0XCIpIHx8XG4gICAgICB0aGlzLl9jb21wbGV0aW9uUGFyYW1zLm1vZGVsLnN0YXJ0c1dpdGgoXCJ0ZXh0LWRhdmluY2ktMDAyLXJlbmRlclwiKVxuICAgICk7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgX2RlZmF1bHRHZXRNZXNzYWdlQnlJZChcbiAgICBpZDogc3RyaW5nXG4gICk6IFByb21pc2U8dHlwZXMuQ2hhdE1lc3NhZ2U+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLl9tZXNzYWdlU3RvcmUuZ2V0KGlkKTtcbiAgICBjb25zb2xlLmxvZyhcImdldE1lc3NhZ2VCeUlkXCIsIGlkLCByZXMpO1xuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgX2RlZmF1bHRVcHNlcnRNZXNzYWdlKFxuICAgIG1lc3NhZ2U6IHR5cGVzLkNoYXRNZXNzYWdlXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKFwiPT0+dXBzZXJ0TWVzc2FnZT5cIiwgbWVzc2FnZS5pZCwgbWVzc2FnZSk7XG4gICAgYXdhaXQgdGhpcy5fbWVzc2FnZVN0b3JlLnNldChtZXNzYWdlLmlkLCBtZXNzYWdlKTtcbiAgfVxufVxuIl19