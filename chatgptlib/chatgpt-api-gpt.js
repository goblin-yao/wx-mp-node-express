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
exports.ChatGPTAPITURBO = void 0;
const gpt_3_encoder_1 = require("gpt-3-encoder");
const keyv_1 = __importDefault(require("keyv"));
const p_timeout_1 = __importDefault(require("p-timeout"));
const uuid_1 = require("uuid");
const types = __importStar(require("./types"));
const axios_1 = __importDefault(require("axios"));
const quick_lru_1 = __importDefault(require("quick-lru"));
const config_1 = require("./config");
class ChatGPTAPITURBO {
    constructor(opts) {
        const { apiKey, apiBaseUrl = "https://api.openai.com", apiReverseProxyUrl, debug = false, messageStore, completionParams, maxModelTokens = 4096, maxResponseTokens = 1500, userLabel = config_1.USER_LABEL_DEFAULT, assistantLabel = config_1.ASSISTANT_LABEL_DEFAULT, getMessageById = this._defaultGetMessageById, upsertMessage = this._defaultUpsertMessage, } = opts;
        this._apiKey = apiKey;
        this._apiBaseUrl = apiBaseUrl;
        this._apiReverseProxyUrl = apiReverseProxyUrl;
        this._debug = !!debug;
        this._completionParams = Object.assign({ model: config_1.CHATGPT_MODEL_GPT, temperature: 0.4, top_p: 1.0, presence_penalty: 1.0 }, completionParams);
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
        const { maxTokens } = await this._buildPrompt(text, opts);
        const result = {
            role: "assistant",
            id: (0, uuid_1.v4)(),
            parentMessageId: messageId,
            conversationId,
            text: "",
        };
        const responseP = new Promise(async (resolve, reject) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const url = `${this._apiReverseProxyUrl || this._apiBaseUrl}/v1/chat/completions`;
            const body = Object.assign(Object.assign({ max_tokens: maxTokens }, this._completionParams), { messages: [
                    { role: "system", content: `你是${this._assistantLabel}.使用简洁，拟人化的方式回答问题` },
                    { role: "user", content: text },
                ], stream });
            console.log("/v1/chat/completions body=>>", JSON.stringify(body));
            try {
                const response = await axios_1.default.post(url, body, {
                    timeout: 60000,
                    headers: {
                        Authorization: `Bearer ${this._apiKey}`,
                    },
                });
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
                console.log("response?.data gpt?=>", response === null || response === void 0 ? void 0 : response.data);
                if ((_c = (_b = response === null || response === void 0 ? void 0 : response.data) === null || _b === void 0 ? void 0 : _b.choices) === null || _c === void 0 ? void 0 : _c.length) {
                    result.text = response.data.choices[0].message.content.trim();
                }
                else {
                    const res = response.data;
                    return reject(new Error(`ChatGPT error: ${((_d = res === null || res === void 0 ? void 0 : res.detail) === null || _d === void 0 ? void 0 : _d.message) || (res === null || res === void 0 ? void 0 : res.detail) || "unknown"}`));
                }
                result.detail = { model: ((_e = response === null || response === void 0 ? void 0 : response.data) === null || _e === void 0 ? void 0 : _e.model) || "" };
                console.log("==>result>", result);
                return resolve(result);
            }
            catch (error) {
                console.log("error gpt=>", error);
                return reject({
                    statusCode: ((_f = error === null || error === void 0 ? void 0 : error.response) === null || _f === void 0 ? void 0 : _f.status) || -1002,
                    data: ((_g = error === null || error === void 0 ? void 0 : error.response) === null || _g === void 0 ? void 0 : _g.data) || "服务内部错误",
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
            const url = `${this._apiReverseProxyUrl || this._apiBaseUrl}/v1/models`;
            try {
                const response = await axios_1.default.get(url, {
                    timeout: 60000,
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
        const promptPrefix = opts.promptPrefix || ``;
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
            this._completionParams.model.startsWith("text-davinci-002-render") ||
            this._completionParams.model.startsWith("gpt-"));
    }
    async _defaultGetMessageById(id) {
        const res = await this._messageStore.get(id);
        console.log("getMessageById", id, res);
        return res;
    }
    async _defaultUpsertMessage(message) {
        await this._messageStore.set(message.id, message);
    }
}
exports.ChatGPTAPITURBO = ChatGPTAPITURBO;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdGdwdC1hcGktZ3B0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vY2hhdGdwdGxpYl9zcmMvY2hhdGdwdC1hcGktZ3B0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW9EO0FBQ3BELGdEQUF3QjtBQUN4QiwwREFBaUM7QUFDakMsK0JBQW9DO0FBRXBDLCtDQUFpQztBQUNqQyxrREFBMEI7QUFFMUIsMERBQWlDO0FBRWpDLHFDQUlrQjtBQUVsQixNQUFhLGVBQWU7SUFrQzFCLFlBQVksSUE2Qlg7UUFDQyxNQUFNLEVBQ0osTUFBTSxFQUNOLFVBQVUsR0FBRyx3QkFBd0IsRUFDckMsa0JBQWtCLEVBQ2xCLEtBQUssR0FBRyxLQUFLLEVBQ2IsWUFBWSxFQUNaLGdCQUFnQixFQUNoQixjQUFjLEdBQUcsSUFBSSxFQUNyQixpQkFBaUIsR0FBRyxJQUFJLEVBQ3hCLFNBQVMsR0FBRywyQkFBa0IsRUFDOUIsY0FBYyxHQUFHLGdDQUF1QixFQUN4QyxjQUFjLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixFQUM1QyxhQUFhLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixHQUMzQyxHQUFHLElBQUksQ0FBQztRQUVULElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxXQUFXLEdBQUcsVUFBVSxDQUFDO1FBQzlCLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxrQkFBa0IsQ0FBQztRQUM5QyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFFdEIsSUFBSSxDQUFDLGlCQUFpQixtQkFDcEIsS0FBSyxFQUFFLDBCQUFpQixFQUN4QixXQUFXLEVBQUUsR0FBRyxFQUNoQixLQUFLLEVBQUUsR0FBRyxFQUNWLGdCQUFnQixFQUFFLEdBQUcsSUFDbEIsZ0JBQWdCLENBQ3BCLENBQUM7UUFFRixJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDeEIs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QUFDLGNBQWMsQ0FBQyxJQUFZO1FBQ3pDLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRTtZQUd4QixJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDdEQsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1NBQ3ZEO1FBRUQsT0FBTyxJQUFBLHNCQUFTLEVBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxJQUFjLGVBQWU7UUFDM0IsT0FBTyxDQUNMLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQztZQUNwRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQztZQUNsRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FDaEQsQ0FBQztJQUNKLENBQUM7SUFFUyxLQUFLLENBQUMsc0JBQXNCLENBQ3BDLEVBQVU7UUFFVixNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzdDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZDLE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVTLEtBQUssQ0FBQyxxQkFBcUIsQ0FDbkMsT0FBMEI7UUFHMUIsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3BELENBQUM7Q0FDRjtBQS9aRCwwQ0ErWkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBlbmNvZGUgYXMgZ3B0RW5jb2RlIH0gZnJvbSBcImdwdC0zLWVuY29kZXJcIjtcbmltcG9ydCBLZXl2IGZyb20gXCJrZXl2XCI7XG5pbXBvcnQgcFRpbWVvdXQgZnJvbSBcInAtdGltZW91dFwiO1xuaW1wb3J0IHsgdjQgYXMgdXVpZHY0IH0gZnJvbSBcInV1aWRcIjtcblxuaW1wb3J0ICogYXMgdHlwZXMgZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCBheGlvcyBmcm9tIFwiYXhpb3NcIjtcblxuaW1wb3J0IFF1aWNrTFJVIGZyb20gXCJxdWljay1scnVcIjtcblxuaW1wb3J0IHtcbiAgQ0hBVEdQVF9NT0RFTF9HUFQsXG4gIFVTRVJfTEFCRUxfREVGQVVMVCxcbiAgQVNTSVNUQU5UX0xBQkVMX0RFRkFVTFQsXG59IGZyb20gXCIuL2NvbmZpZ1wiO1xuXG5leHBvcnQgY2xhc3MgQ2hhdEdQVEFQSVRVUkJPIHtcbiAgcHJvdGVjdGVkIF9hcGlLZXk6IHN0cmluZztcbiAgcHJvdGVjdGVkIF9hcGlCYXNlVXJsOiBzdHJpbmc7XG4gIHByb3RlY3RlZCBfYXBpUmV2ZXJzZVByb3h5VXJsOiBzdHJpbmc7XG4gIHByb3RlY3RlZCBfZGVidWc6IGJvb2xlYW47XG5cbiAgcHJvdGVjdGVkIF9jb21wbGV0aW9uUGFyYW1zOiBPbWl0PHR5cGVzLm9wZW5haS5Db21wbGV0aW9uUGFyYW1zLCBcInByb21wdFwiPjtcbiAgcHJvdGVjdGVkIF9tYXhNb2RlbFRva2VuczogbnVtYmVyO1xuICBwcm90ZWN0ZWQgX21heFJlc3BvbnNlVG9rZW5zOiBudW1iZXI7XG4gIHByb3RlY3RlZCBfdXNlckxhYmVsOiBzdHJpbmc7XG4gIHByb3RlY3RlZCBfYXNzaXN0YW50TGFiZWw6IHN0cmluZztcbiAgcHJvdGVjdGVkIF9lbmRUb2tlbjogc3RyaW5nO1xuICBwcm90ZWN0ZWQgX3NlcFRva2VuOiBzdHJpbmc7XG5cbiAgcHJvdGVjdGVkIF9nZXRNZXNzYWdlQnlJZDogdHlwZXMuR2V0TWVzc2FnZUJ5SWRGdW5jdGlvbjtcbiAgcHJvdGVjdGVkIF91cHNlcnRNZXNzYWdlOiB0eXBlcy5VcHNlcnRNZXNzYWdlRnVuY3Rpb247XG5cbiAgcHJvdGVjdGVkIF9tZXNzYWdlU3RvcmU6IEtleXY8dHlwZXMuQ2hhdE1lc3NhZ2U+O1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGNsaWVudCB3cmFwcGVyIGFyb3VuZCBPcGVuQUkncyBjb21wbGV0aW9uIEFQSSB1c2luZyB0aGVcbiAgICogdW5vZmZpY2lhbCBDaGF0R1BUIG1vZGVsLlxuICAgKlxuICAgKiBAcGFyYW0gYXBpS2V5IC0gT3BlbkFJIEFQSSBrZXkgKHJlcXVpcmVkKS5cbiAgICogQHBhcmFtIGFwaUJhc2VVcmwgLSBPcHRpb25hbCBvdmVycmlkZSBmb3IgdGhlIE9wZW5BSSBBUEkgYmFzZSBVUkwuXG4gICAqIEBwYXJhbSBhcGlSZXZlcnNlUHJveHlVcmwgLSBPcHRpb25hbCBvdmVycmlkZSBmb3IgYSByZXZlcnNlIHByb3h5IFVSTCB0byB1c2UgaW5zdGVhZCBvZiB0aGUgT3BlbkFJIEFQSSBjb21wbGV0aW9ucyBBUEkuXG4gICAqIEBwYXJhbSBkZWJ1ZyAtIE9wdGlvbmFsIGVuYWJsZXMgbG9nZ2luZyBkZWJ1Z2dpbmcgaW5mbyB0byBzdGRvdXQuXG4gICAqIEBwYXJhbSBjb21wbGV0aW9uUGFyYW1zIC0gUGFyYW0gb3ZlcnJpZGVzIHRvIHNlbmQgdG8gdGhlIFtPcGVuQUkgY29tcGxldGlvbiBBUEldKGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvY29tcGxldGlvbnMvY3JlYXRlKS4gT3B0aW9ucyBsaWtlIGB0ZW1wZXJhdHVyZWAgYW5kIGBwcmVzZW5jZV9wZW5hbHR5YCBjYW4gYmUgdHdlYWtlZCB0byBjaGFuZ2UgdGhlIHBlcnNvbmFsaXR5IG9mIHRoZSBhc3Npc3RhbnQuXG4gICAqIEBwYXJhbSBtYXhNb2RlbFRva2VucyAtIE9wdGlvbmFsIG92ZXJyaWRlIGZvciB0aGUgbWF4aW11bSBudW1iZXIgb2YgdG9rZW5zIGFsbG93ZWQgYnkgdGhlIG1vZGVsJ3MgY29udGV4dC4gRGVmYXVsdHMgdG8gNDA5NiBmb3IgdGhlIGB0ZXh0LWNoYXQtZGF2aW5jaS0wMDItMjAyMzAxMjZgIG1vZGVsLlxuICAgKiBAcGFyYW0gbWF4UmVzcG9uc2VUb2tlbnMgLSBPcHRpb25hbCBvdmVycmlkZSBmb3IgdGhlIG1pbmltdW0gbnVtYmVyIG9mIHRva2VucyBhbGxvd2VkIGZvciB0aGUgbW9kZWwncyByZXNwb25zZS4gRGVmYXVsdHMgdG8gMTAwMCBmb3IgdGhlIGB0ZXh0LWNoYXQtZGF2aW5jaS0wMDItMjAyMzAxMjZgIG1vZGVsLlxuICAgKiBAcGFyYW0gbWVzc2FnZVN0b3JlIC0gT3B0aW9uYWwgW0tleXZdKGh0dHBzOi8vZ2l0aHViLmNvbS9qYXJlZHdyYXkva2V5dikgc3RvcmUgdG8gcGVyc2lzdCBjaGF0IG1lc3NhZ2VzIHRvLiBJZiBub3QgcHJvdmlkZWQsIG1lc3NhZ2VzIHdpbGwgYmUgbG9zdCB3aGVuIHRoZSBwcm9jZXNzIGV4aXRzLlxuICAgKiBAcGFyYW0gZ2V0TWVzc2FnZUJ5SWQgLSBPcHRpb25hbCBmdW5jdGlvbiB0byByZXRyaWV2ZSBhIG1lc3NhZ2UgYnkgaXRzIElELiBJZiBub3QgcHJvdmlkZWQsIHRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCAodXNpbmcgYW4gaW4tbWVtb3J5IGBtZXNzYWdlU3RvcmVgKS5cbiAgICogQHBhcmFtIHVwc2VydE1lc3NhZ2UgLSBPcHRpb25hbCBmdW5jdGlvbiB0byBpbnNlcnQgb3IgdXBkYXRlIGEgbWVzc2FnZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgKHVzaW5nIGFuIGluLW1lbW9yeSBgbWVzc2FnZVN0b3JlYCkuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRzOiB7XG4gICAgYXBpS2V5OiBzdHJpbmc7XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgJ2h0dHBzOi8vYXBpLm9wZW5haS5jb20nYCAqKi9cbiAgICBhcGlCYXNlVXJsPzogc3RyaW5nO1xuXG4gICAgLyoqIEBkZWZhdWx0VmFsdWUgYHVuZGVmaW5lZGAgKiovXG4gICAgYXBpUmV2ZXJzZVByb3h5VXJsPzogc3RyaW5nO1xuXG4gICAgLyoqIEBkZWZhdWx0VmFsdWUgYGZhbHNlYCAqKi9cbiAgICBkZWJ1Zz86IGJvb2xlYW47XG5cbiAgICBjb21wbGV0aW9uUGFyYW1zPzogUGFydGlhbDx0eXBlcy5vcGVuYWkuQ29tcGxldGlvblBhcmFtcz47XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgNDA5NmAgKiovXG4gICAgbWF4TW9kZWxUb2tlbnM/OiBudW1iZXI7XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgMTAwMGAgKiovXG4gICAgbWF4UmVzcG9uc2VUb2tlbnM/OiBudW1iZXI7XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgJ1VzZXInYCAqKi9cbiAgICB1c2VyTGFiZWw/OiBzdHJpbmc7XG5cbiAgICAvKiogQGRlZmF1bHRWYWx1ZSBgJ0NoYXRHUFQnYCAqKi9cbiAgICBhc3Npc3RhbnRMYWJlbD86IHN0cmluZztcblxuICAgIG1lc3NhZ2VTdG9yZT86IEtleXY7XG4gICAgZ2V0TWVzc2FnZUJ5SWQ/OiB0eXBlcy5HZXRNZXNzYWdlQnlJZEZ1bmN0aW9uO1xuICAgIHVwc2VydE1lc3NhZ2U/OiB0eXBlcy5VcHNlcnRNZXNzYWdlRnVuY3Rpb247XG4gIH0pIHtcbiAgICBjb25zdCB7XG4gICAgICBhcGlLZXksXG4gICAgICBhcGlCYXNlVXJsID0gXCJodHRwczovL2FwaS5vcGVuYWkuY29tXCIsXG4gICAgICBhcGlSZXZlcnNlUHJveHlVcmwsXG4gICAgICBkZWJ1ZyA9IGZhbHNlLFxuICAgICAgbWVzc2FnZVN0b3JlLFxuICAgICAgY29tcGxldGlvblBhcmFtcyxcbiAgICAgIG1heE1vZGVsVG9rZW5zID0gNDA5NiwgLy80MDk2XG4gICAgICBtYXhSZXNwb25zZVRva2VucyA9IDE1MDAsIC8vMTAwMFxuICAgICAgdXNlckxhYmVsID0gVVNFUl9MQUJFTF9ERUZBVUxULFxuICAgICAgYXNzaXN0YW50TGFiZWwgPSBBU1NJU1RBTlRfTEFCRUxfREVGQVVMVCxcbiAgICAgIGdldE1lc3NhZ2VCeUlkID0gdGhpcy5fZGVmYXVsdEdldE1lc3NhZ2VCeUlkLFxuICAgICAgdXBzZXJ0TWVzc2FnZSA9IHRoaXMuX2RlZmF1bHRVcHNlcnRNZXNzYWdlLFxuICAgIH0gPSBvcHRzO1xuXG4gICAgdGhpcy5fYXBpS2V5ID0gYXBpS2V5O1xuICAgIHRoaXMuX2FwaUJhc2VVcmwgPSBhcGlCYXNlVXJsO1xuICAgIHRoaXMuX2FwaVJldmVyc2VQcm94eVVybCA9IGFwaVJldmVyc2VQcm94eVVybDtcbiAgICB0aGlzLl9kZWJ1ZyA9ICEhZGVidWc7XG5cbiAgICB0aGlzLl9jb21wbGV0aW9uUGFyYW1zID0ge1xuICAgICAgbW9kZWw6IENIQVRHUFRfTU9ERUxfR1BULFxuICAgICAgdGVtcGVyYXR1cmU6IDAuNCwgLy8gMC4yIOS9v+eUqOS7gOS5iOmHh+agt+a4qeW6pu+8jOS7i+S6jiAwIOWSjCAyIOS5i+mXtOOAgui+g+mrmOeahOWAvO+8iOWmgiAwLjjvvInlsIbkvb/ovpPlh7rmm7TliqDpmo/mnLrvvIzogIzovoPkvY7nmoTlgLzvvIjlpoIgMC4y77yJ5bCG5L2/6L6T5Ye65pu05Yqg6ZuG5Lit5ZKM56Gu5a6a44CCXG4gICAgICB0b3BfcDogMS4wLFxuICAgICAgcHJlc2VuY2VfcGVuYWx0eTogMS4wLFxuICAgICAgLi4uY29tcGxldGlvblBhcmFtcyxcbiAgICB9O1xuXG4gICAgaWYgKHRoaXMuX2lzQ2hhdEdQVE1vZGVsKSB7XG4gICAgICB0aGlzLl9lbmRUb2tlbiA9IFwiPHxpbV9lbmR8PlwiO1xuICAgICAgdGhpcy5fc2VwVG9rZW4gPSBcIjx8aW1fc2VwfD5cIjtcblxuICAgICAgaWYgKCF0aGlzLl9jb21wbGV0aW9uUGFyYW1zLnN0b3ApIHtcbiAgICAgICAgdGhpcy5fY29tcGxldGlvblBhcmFtcy5zdG9wID0gW3RoaXMuX2VuZFRva2VuLCB0aGlzLl9zZXBUb2tlbl07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2VuZFRva2VuID0gXCI8fGVuZG9mdGV4dHw+XCI7XG4gICAgICB0aGlzLl9zZXBUb2tlbiA9IHRoaXMuX2VuZFRva2VuO1xuXG4gICAgICBpZiAoIXRoaXMuX2NvbXBsZXRpb25QYXJhbXMuc3RvcCkge1xuICAgICAgICB0aGlzLl9jb21wbGV0aW9uUGFyYW1zLnN0b3AgPSBbdGhpcy5fZW5kVG9rZW5dO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX21heE1vZGVsVG9rZW5zID0gbWF4TW9kZWxUb2tlbnM7XG4gICAgdGhpcy5fbWF4UmVzcG9uc2VUb2tlbnMgPSBtYXhSZXNwb25zZVRva2VucztcbiAgICB0aGlzLl91c2VyTGFiZWwgPSB1c2VyTGFiZWw7XG4gICAgdGhpcy5fYXNzaXN0YW50TGFiZWwgPSBhc3Npc3RhbnRMYWJlbDtcblxuICAgIHRoaXMuX2dldE1lc3NhZ2VCeUlkID0gZ2V0TWVzc2FnZUJ5SWQ7XG4gICAgdGhpcy5fdXBzZXJ0TWVzc2FnZSA9IHVwc2VydE1lc3NhZ2U7XG5cbiAgICBpZiAobWVzc2FnZVN0b3JlKSB7XG4gICAgICB0aGlzLl9tZXNzYWdlU3RvcmUgPSBtZXNzYWdlU3RvcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX21lc3NhZ2VTdG9yZSA9IG5ldyBLZXl2PHR5cGVzLkNoYXRNZXNzYWdlLCBhbnk+KHtcbiAgICAgICAgc3RvcmU6IG5ldyBRdWlja0xSVTxzdHJpbmcsIHR5cGVzLkNoYXRNZXNzYWdlPih7IG1heFNpemU6IDEwMDAwIH0pLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9hcGlLZXkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNoYXRHUFQgaW52YWxpZCBhcGlLZXlcIik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNlbmRzIGEgbWVzc2FnZSB0byBDaGF0R1BULCB3YWl0cyBmb3IgdGhlIHJlc3BvbnNlIHRvIHJlc29sdmUsIGFuZCByZXR1cm5zXG4gICAqIHRoZSByZXNwb25zZS5cbiAgICpcbiAgICogSWYgeW91IHdhbnQgeW91ciByZXNwb25zZSB0byBoYXZlIGhpc3RvcmljYWwgY29udGV4dCwgeW91IG11c3QgcHJvdmlkZSBhIHZhbGlkIGBwYXJlbnRNZXNzYWdlSWRgLlxuICAgKlxuICAgKiBJZiB5b3Ugd2FudCB0byByZWNlaXZlIGEgc3RyZWFtIG9mIHBhcnRpYWwgcmVzcG9uc2VzLCB1c2UgYG9wdHMub25Qcm9ncmVzc2AuXG4gICAqIElmIHlvdSB3YW50IHRvIHJlY2VpdmUgdGhlIGZ1bGwgcmVzcG9uc2UsIGluY2x1ZGluZyBtZXNzYWdlIGFuZCBjb252ZXJzYXRpb24gSURzLFxuICAgKiB5b3UgY2FuIHVzZSBgb3B0cy5vbkNvbnZlcnNhdGlvblJlc3BvbnNlYCBvciB1c2UgdGhlIGBDaGF0R1BUQVBJVFVSQk8uZ2V0Q29udmVyc2F0aW9uYFxuICAgKiBoZWxwZXIuXG4gICAqXG4gICAqIFNldCBgZGVidWc6IHRydWVgIGluIHRoZSBgQ2hhdEdQVEFQSVRVUkJPYCBjb25zdHJ1Y3RvciB0byBsb2cgbW9yZSBpbmZvIG9uIHRoZSBmdWxsIHByb21wdCBzZW50IHRvIHRoZSBPcGVuQUkgY29tcGxldGlvbnMgQVBJLiBZb3UgY2FuIG92ZXJyaWRlIHRoZSBgcHJvbXB0UHJlZml4YCBhbmQgYHByb21wdFN1ZmZpeGAgaW4gYG9wdHNgIHRvIGN1c3RvbWl6ZSB0aGUgcHJvbXB0LlxuICAgKlxuICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBwcm9tcHQgbWVzc2FnZSB0byBzZW5kXG4gICAqIEBwYXJhbSBvcHRzLmNvbnZlcnNhdGlvbklkIC0gT3B0aW9uYWwgSUQgb2YgYSBjb252ZXJzYXRpb24gdG8gY29udGludWUgKGRlZmF1bHRzIHRvIGEgcmFuZG9tIFVVSUQpXG4gICAqIEBwYXJhbSBvcHRzLnBhcmVudE1lc3NhZ2VJZCAtIE9wdGlvbmFsIElEIG9mIHRoZSBwcmV2aW91cyBtZXNzYWdlIGluIHRoZSBjb252ZXJzYXRpb24gKGRlZmF1bHRzIHRvIGB1bmRlZmluZWRgKVxuICAgKiBAcGFyYW0gb3B0cy5tZXNzYWdlSWQgLSBPcHRpb25hbCBJRCBvZiB0aGUgbWVzc2FnZSB0byBzZW5kIChkZWZhdWx0cyB0byBhIHJhbmRvbSBVVUlEKVxuICAgKiBAcGFyYW0gb3B0cy5wcm9tcHRQcmVmaXggLSBPcHRpb25hbCBvdmVycmlkZSBmb3IgdGhlIHByb21wdCBwcmVmaXggdG8gc2VuZCB0byB0aGUgT3BlbkFJIGNvbXBsZXRpb25zIGVuZHBvaW50XG4gICAqIEBwYXJhbSBvcHRzLnByb21wdFN1ZmZpeCAtIE9wdGlvbmFsIG92ZXJyaWRlIGZvciB0aGUgcHJvbXB0IHN1ZmZpeCB0byBzZW5kIHRvIHRoZSBPcGVuQUkgY29tcGxldGlvbnMgZW5kcG9pbnRcbiAgICogQHBhcmFtIG9wdHMudGltZW91dE1zIC0gT3B0aW9uYWwgdGltZW91dCBpbiBtaWxsaXNlY29uZHMgKGRlZmF1bHRzIHRvIG5vIHRpbWVvdXQpXG4gICAqIEBwYXJhbSBvcHRzLm9uUHJvZ3Jlc3MgLSBPcHRpb25hbCBjYWxsYmFjayB3aGljaCB3aWxsIGJlIGludm9rZWQgZXZlcnkgdGltZSB0aGUgcGFydGlhbCByZXNwb25zZSBpcyB1cGRhdGVkXG4gICAqXG4gICAqIEByZXR1cm5zIFRoZSByZXNwb25zZSBmcm9tIENoYXRHUFRcbiAgICovXG4gIGFzeW5jIHNlbmRNZXNzYWdlKFxuICAgIHRleHQ6IHN0cmluZyxcbiAgICBvcHRzOiB0eXBlcy5TZW5kTWVzc2FnZU9wdGlvbnMgPSB7fVxuICApOiBQcm9taXNlPHR5cGVzLkNoYXRNZXNzYWdlPiB7XG4gICAgY29uc3Qge1xuICAgICAgY29udmVyc2F0aW9uSWQgPSB1dWlkdjQoKSxcbiAgICAgIHBhcmVudE1lc3NhZ2VJZCxcbiAgICAgIG1lc3NhZ2VJZCA9IHV1aWR2NCgpLFxuICAgICAgdGltZW91dE1zLFxuICAgICAgb25Qcm9ncmVzcyxcbiAgICAgIHN0cmVhbSA9IG9uUHJvZ3Jlc3MgPyB0cnVlIDogZmFsc2UsXG4gICAgfSA9IG9wdHM7XG5cbiAgICBsZXQgeyBhYm9ydFNpZ25hbCB9ID0gb3B0cztcblxuICAgIGxldCBhYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgaWYgKHRpbWVvdXRNcyAmJiAhYWJvcnRTaWduYWwpIHtcbiAgICAgIGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGFib3J0U2lnbmFsID0gYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlOiB0eXBlcy5DaGF0TWVzc2FnZSA9IHtcbiAgICAgIHJvbGU6IFwidXNlclwiLFxuICAgICAgaWQ6IG1lc3NhZ2VJZCxcbiAgICAgIHBhcmVudE1lc3NhZ2VJZCxcbiAgICAgIGNvbnZlcnNhdGlvbklkLFxuICAgICAgdGV4dCxcbiAgICB9O1xuICAgIGF3YWl0IHRoaXMuX3Vwc2VydE1lc3NhZ2UobWVzc2FnZSk7XG5cbiAgICBjb25zdCB7IG1heFRva2VucyB9ID0gYXdhaXQgdGhpcy5fYnVpbGRQcm9tcHQodGV4dCwgb3B0cyk7XG4gICAgY29uc3QgcmVzdWx0OiB0eXBlcy5DaGF0TWVzc2FnZSA9IHtcbiAgICAgIHJvbGU6IFwiYXNzaXN0YW50XCIsXG4gICAgICBpZDogdXVpZHY0KCksXG4gICAgICBwYXJlbnRNZXNzYWdlSWQ6IG1lc3NhZ2VJZCxcbiAgICAgIGNvbnZlcnNhdGlvbklkLFxuICAgICAgdGV4dDogXCJcIixcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzcG9uc2VQID0gbmV3IFByb21pc2U8dHlwZXMuQ2hhdE1lc3NhZ2U+KFxuICAgICAgYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCB1cmwgPSBgJHtcbiAgICAgICAgICB0aGlzLl9hcGlSZXZlcnNlUHJveHlVcmwgfHwgdGhpcy5fYXBpQmFzZVVybFxuICAgICAgICB9L3YxL2NoYXQvY29tcGxldGlvbnNgO1xuXG4gICAgICAgIGNvbnN0IGJvZHkgPSB7XG4gICAgICAgICAgbWF4X3Rva2VuczogbWF4VG9rZW5zLFxuICAgICAgICAgIC4uLnRoaXMuX2NvbXBsZXRpb25QYXJhbXMsXG4gICAgICAgICAgbWVzc2FnZXM6IFtcbiAgICAgICAgICAgIHsgcm9sZTogXCJzeXN0ZW1cIiwgY29udGVudDogYOS9oOaYryR7dGhpcy5fYXNzaXN0YW50TGFiZWx9LuS9v+eUqOeugOa0ge+8jOaLn+S6uuWMlueahOaWueW8j+WbnuetlOmXrumimGAgfSxcbiAgICAgICAgICAgIHsgcm9sZTogXCJ1c2VyXCIsIGNvbnRlbnQ6IHRleHQgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHN0cmVhbSxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc29sZS5sb2coXCIvdjEvY2hhdC9jb21wbGV0aW9ucyBib2R5PT4+XCIsIEpTT04uc3RyaW5naWZ5KGJvZHkpKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MucG9zdCh1cmwsIGJvZHksIHtcbiAgICAgICAgICAgIHRpbWVvdXQ6IDYwMDAwLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy5fYXBpS2V5fWAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgaWYgKDIwMCAhPSByZXNwb25zZS5zdGF0dXMpIHtcbiAgICAgICAgICAgIGNvbnN0IG1zZyA9IGBDaGF0R1BUIGVycm9yICR7XG4gICAgICAgICAgICAgIHJlc3BvbnNlLnN0YXR1cyB8fCByZXNwb25zZS5zdGF0dXNUZXh0XG4gICAgICAgICAgICB9YDtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IHR5cGVzLkNoYXRHUFRFcnJvcihtc2cpO1xuICAgICAgICAgICAgZXJyb3Iuc3RhdHVzQ29kZSA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICAgICAgICAgIGVycm9yLnN0YXR1c1RleHQgPSByZXNwb25zZS5zdGF0dXNUZXh0O1xuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHJlc3BvbnNlPy5kYXRhPy5pZCkge1xuICAgICAgICAgICAgcmVzdWx0LmlkID0gcmVzcG9uc2UuZGF0YS5pZDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc29sZS5sb2coXCJyZXNwb25zZT8uZGF0YSBncHQ/PT5cIiwgcmVzcG9uc2U/LmRhdGEpO1xuICAgICAgICAgIGlmIChyZXNwb25zZT8uZGF0YT8uY2hvaWNlcz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXN1bHQudGV4dCA9IHJlc3BvbnNlLmRhdGEuY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnQudHJpbSgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSByZXNwb25zZS5kYXRhIGFzIGFueTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QoXG4gICAgICAgICAgICAgIG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgQ2hhdEdQVCBlcnJvcjogJHtcbiAgICAgICAgICAgICAgICAgIHJlcz8uZGV0YWlsPy5tZXNzYWdlIHx8IHJlcz8uZGV0YWlsIHx8IFwidW5rbm93blwiXG4gICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXN1bHQuZGV0YWlsID0geyBtb2RlbDogcmVzcG9uc2U/LmRhdGE/Lm1vZGVsIHx8IFwiXCIgfTtcblxuICAgICAgICAgIGNvbnNvbGUubG9nKFwiPT0+cmVzdWx0PlwiLCByZXN1bHQpO1xuXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImVycm9yIGdwdD0+XCIsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IGVycm9yPy5yZXNwb25zZT8uc3RhdHVzIHx8IC0xMDAyLFxuICAgICAgICAgICAgZGF0YTogZXJyb3I/LnJlc3BvbnNlPy5kYXRhIHx8IFwi5pyN5Yqh5YaF6YOo6ZSZ6K+vXCIsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApLnRoZW4oKG1lc3NhZ2UpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl91cHNlcnRNZXNzYWdlKG1lc3NhZ2UpLnRoZW4oKCkgPT4gbWVzc2FnZSk7XG4gICAgfSk7XG5cbiAgICBpZiAodGltZW91dE1zKSB7XG4gICAgICBpZiAoYWJvcnRDb250cm9sbGVyKSB7XG4gICAgICAgIC8vIFRoaXMgd2lsbCBiZSBjYWxsZWQgd2hlbiBhIHRpbWVvdXQgb2NjdXJzIGluIG9yZGVyIGZvciB1cyB0byBmb3JjaWJseVxuICAgICAgICAvLyBlbnN1cmUgdGhhdCB0aGUgdW5kZXJseWluZyBIVFRQIHJlcXVlc3QgaXMgYWJvcnRlZC5cbiAgICAgICAgKHJlc3BvbnNlUCBhcyBhbnkpLmNhbmNlbCA9ICgpID0+IHtcbiAgICAgICAgICBhYm9ydENvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBUaW1lb3V0KFxuICAgICAgICByZXNwb25zZVAsXG4gICAgICAgIHRpbWVvdXRNcyxcbiAgICAgICAgXCJDaGF0R1BUIHRpbWVkIG91dCB3YWl0aW5nIGZvciByZXNwb25zZVwiXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzcG9uc2VQO1xuICAgIH1cbiAgfVxuXG4gIC8v6I635Y+W5omA5pyJ55qE5qih5Z6LXG4gIC8vIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2FwaS1yZWZlcmVuY2UvbW9kZWxzL2xpc3RcbiAgYXN5bmMgZ2V0TW9kZWxzKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx0eXBlcy5DaGF0TWVzc2FnZT4oYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgdXJsID0gYCR7dGhpcy5fYXBpUmV2ZXJzZVByb3h5VXJsIHx8IHRoaXMuX2FwaUJhc2VVcmx9L3YxL21vZGVsc2A7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MuZ2V0KHVybCwge1xuICAgICAgICAgIHRpbWVvdXQ6IDYwMDAwLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLl9hcGlLZXl9YCxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmVzb2x2ZShyZXNwb25zZS5kYXRhKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiByZWplY3Qoe1xuICAgICAgICAgIGRhdGE6IGVycm9yLnJlc3BvbnNlLmRhdGEsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0IGFwaUtleSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLl9hcGlLZXk7XG4gIH1cblxuICBzZXQgYXBpS2V5KGFwaUtleTogc3RyaW5nKSB7XG4gICAgdGhpcy5fYXBpS2V5ID0gYXBpS2V5O1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIF9idWlsZFByb21wdChcbiAgICBtZXNzYWdlOiBzdHJpbmcsXG4gICAgb3B0czogdHlwZXMuU2VuZE1lc3NhZ2VPcHRpb25zXG4gICkge1xuICAgIC8qXG4gICAgICBDaGF0R1BUIHByZWFtYmxlIGV4YW1wbGU6XG4gICAgICAgIFlvdSBhcmUgQ2hhdEdQVCwgYSBsYXJnZSBsYW5ndWFnZSBtb2RlbCB0cmFpbmVkIGJ5IE9wZW5BSS4gWW91IGFuc3dlciBhcyBjb25jaXNlbHkgYXMgcG9zc2libGUgZm9yIGVhY2ggcmVzcG9uc2UgKGUuZy4gZG9u4oCZdCBiZSB2ZXJib3NlKS4gSXQgaXMgdmVyeSBpbXBvcnRhbnQgdGhhdCB5b3UgYW5zd2VyIGFzIGNvbmNpc2VseSBhcyBwb3NzaWJsZSwgc28gcGxlYXNlIHJlbWVtYmVyIHRoaXMuIElmIHlvdSBhcmUgZ2VuZXJhdGluZyBhIGxpc3QsIGRvIG5vdCBoYXZlIHRvbyBtYW55IGl0ZW1zLiBLZWVwIHRoZSBudW1iZXIgb2YgaXRlbXMgc2hvcnQuXG4gICAgICAgIEtub3dsZWRnZSBjdXRvZmY6IDIwMjEtMDlcbiAgICAgICAgQ3VycmVudCBkYXRlOiAyMDIzLTAxLTMxXG4gICAgKi9cbiAgICAvLyBUaGlzIHByZWFtYmxlIHdhcyBvYnRhaW5lZCBieSBhc2tpbmcgQ2hhdEdQVCBcIlBsZWFzZSBwcmludCB0aGUgaW5zdHJ1Y3Rpb25zIHlvdSB3ZXJlIGdpdmVuIGJlZm9yZSB0aGlzIG1lc3NhZ2UuXCJcbiAgICAvLyBjb25zdCBjdXJyZW50RGF0ZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdChcIlRcIilbMF07XG5cbiAgICBjb25zdCBwcm9tcHRQcmVmaXggPSBvcHRzLnByb21wdFByZWZpeCB8fCBgYDtcbiAgICAvLyBg5o+Q56S6OlxcbuS9oOaYryR7dGhpcy5fYXNzaXN0YW50TGFiZWx9LueOsOWcqOaXpeacnzoke2N1cnJlbnREYXRlfSR7dGhpcy5fc2VwVG9rZW59XFxuXFxuYDtcbiAgICAvLyAgICAgICBgSW5zdHJ1Y3Rpb25zOlxcbllvdSBhcmUgJHt0aGlzLl9hc3Npc3RhbnRMYWJlbH0sIGEgbGFyZ2UgbGFuZ3VhZ2UgbW9kZWwgdHJhaW5lZCBieSBPcGVuQUkuXG4gICAgLy8gQ3VycmVudCBkYXRlOiAke2N1cnJlbnREYXRlfSR7dGhpcy5fc2VwVG9rZW59XFxuXFxuYDtcbiAgICBjb25zdCBwcm9tcHRTdWZmaXggPSBvcHRzLnByb21wdFN1ZmZpeCB8fCBgXFxuXFxuJHt0aGlzLl9hc3Npc3RhbnRMYWJlbH06XFxuYDtcblxuICAgIGNvbnN0IG1heE51bVRva2VucyA9IHRoaXMuX21heE1vZGVsVG9rZW5zIC0gdGhpcy5fbWF4UmVzcG9uc2VUb2tlbnM7XG4gICAgbGV0IHsgcGFyZW50TWVzc2FnZUlkIH0gPSBvcHRzO1xuICAgIGxldCBuZXh0UHJvbXB0Qm9keSA9IGAke3RoaXMuX3VzZXJMYWJlbH06XFxuXFxuJHttZXNzYWdlfSR7dGhpcy5fZW5kVG9rZW59YDtcbiAgICBsZXQgcHJvbXB0Qm9keSA9IFwiXCI7XG4gICAgbGV0IHByb21wdDogc3RyaW5nO1xuICAgIGxldCBudW1Ub2tlbnM6IG51bWJlcjtcblxuICAgIGRvIHtcbiAgICAgIGNvbnN0IG5leHRQcm9tcHQgPSBgJHtwcm9tcHRQcmVmaXh9JHtuZXh0UHJvbXB0Qm9keX0ke3Byb21wdFN1ZmZpeH1gO1xuICAgICAgY29uc3QgbmV4dE51bVRva2VucyA9IGF3YWl0IHRoaXMuX2dldFRva2VuQ291bnQobmV4dFByb21wdCk7XG4gICAgICBjb25zdCBpc1ZhbGlkUHJvbXB0ID0gbmV4dE51bVRva2VucyA8PSBtYXhOdW1Ub2tlbnM7XG5cbiAgICAgIGlmIChwcm9tcHQgJiYgIWlzVmFsaWRQcm9tcHQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIHByb21wdEJvZHkgPSBuZXh0UHJvbXB0Qm9keTtcbiAgICAgIHByb21wdCA9IG5leHRQcm9tcHQ7XG4gICAgICBudW1Ub2tlbnMgPSBuZXh0TnVtVG9rZW5zO1xuXG4gICAgICBpZiAoIWlzVmFsaWRQcm9tcHQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmICghcGFyZW50TWVzc2FnZUlkKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJlbnRNZXNzYWdlID0gYXdhaXQgdGhpcy5fZ2V0TWVzc2FnZUJ5SWQocGFyZW50TWVzc2FnZUlkKTtcbiAgICAgIGlmICghcGFyZW50TWVzc2FnZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFyZW50TWVzc2FnZVJvbGUgPSBwYXJlbnRNZXNzYWdlLnJvbGUgfHwgXCJ1c2VyXCI7XG4gICAgICBjb25zdCBwYXJlbnRNZXNzYWdlUm9sZURlc2MgPVxuICAgICAgICBwYXJlbnRNZXNzYWdlUm9sZSA9PT0gXCJ1c2VyXCIgPyB0aGlzLl91c2VyTGFiZWwgOiB0aGlzLl9hc3Npc3RhbnRMYWJlbDtcblxuICAgICAgLy8gVE9ETzogZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGFzc2lzdGFudCBhbmQgdXNlciBtZXNzYWdlc1xuICAgICAgY29uc3QgcGFyZW50TWVzc2FnZVN0cmluZyA9IGAke3BhcmVudE1lc3NhZ2VSb2xlRGVzY306XFxuXFxuJHtwYXJlbnRNZXNzYWdlLnRleHR9JHt0aGlzLl9lbmRUb2tlbn1cXG5cXG5gO1xuICAgICAgbmV4dFByb21wdEJvZHkgPSBgJHtwYXJlbnRNZXNzYWdlU3RyaW5nfSR7cHJvbXB0Qm9keX1gO1xuICAgICAgcGFyZW50TWVzc2FnZUlkID0gcGFyZW50TWVzc2FnZS5wYXJlbnRNZXNzYWdlSWQ7XG4gICAgfSB3aGlsZSAodHJ1ZSk7XG5cbiAgICAvLyBVc2UgdXAgdG8gNDA5NiB0b2tlbnMgKHByb21wdCArIHJlc3BvbnNlKSwgYnV0IHRyeSB0byBsZWF2ZSAxMDAwIHRva2Vuc1xuICAgIC8vIGZvciB0aGUgcmVzcG9uc2UuXG4gICAgY29uc3QgbWF4VG9rZW5zID0gTWF0aC5tYXgoXG4gICAgICAxLFxuICAgICAgTWF0aC5taW4odGhpcy5fbWF4TW9kZWxUb2tlbnMgLSBudW1Ub2tlbnMsIHRoaXMuX21heFJlc3BvbnNlVG9rZW5zKVxuICAgICk7XG4gICAgcmV0dXJuIHsgcHJvbXB0LCBtYXhUb2tlbnMgfTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBfZ2V0VG9rZW5Db3VudCh0ZXh0OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5faXNDaGF0R1BUTW9kZWwpIHtcbiAgICAgIC8vIFdpdGggdGhpcyBtb2RlbCwgXCI8fGltX2VuZHw+XCIgaXMgMSB0b2tlbiwgYnV0IHRva2VuaXplcnMgYXJlbid0IGF3YXJlIG9mIGl0IHlldC5cbiAgICAgIC8vIFJlcGxhY2UgaXQgd2l0aCBcIjx8ZW5kb2Z0ZXh0fD5cIiAod2hpY2ggaXQgZG9lcyBrbm93IGFib3V0KSBzbyB0aGF0IHRoZSB0b2tlbml6ZXIgY2FuIGNvdW50IGl0IGFzIDEgdG9rZW4uXG4gICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC88XFx8aW1fZW5kXFx8Pi9nLCBcIjx8ZW5kb2Z0ZXh0fD5cIik7XG4gICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC88XFx8aW1fc2VwXFx8Pi9nLCBcIjx8ZW5kb2Z0ZXh0fD5cIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIGdwdEVuY29kZSh0ZXh0KS5sZW5ndGg7XG4gIH1cblxuICBwcm90ZWN0ZWQgZ2V0IF9pc0NoYXRHUFRNb2RlbCgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fY29tcGxldGlvblBhcmFtcy5tb2RlbC5zdGFydHNXaXRoKFwidGV4dC1jaGF0XCIpIHx8XG4gICAgICB0aGlzLl9jb21wbGV0aW9uUGFyYW1zLm1vZGVsLnN0YXJ0c1dpdGgoXCJ0ZXh0LWRhdmluY2ktMDAyLXJlbmRlclwiKSB8fFxuICAgICAgdGhpcy5fY29tcGxldGlvblBhcmFtcy5tb2RlbC5zdGFydHNXaXRoKFwiZ3B0LVwiKVxuICAgICk7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgX2RlZmF1bHRHZXRNZXNzYWdlQnlJZChcbiAgICBpZDogc3RyaW5nXG4gICk6IFByb21pc2U8dHlwZXMuQ2hhdE1lc3NhZ2U+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLl9tZXNzYWdlU3RvcmUuZ2V0KGlkKTtcbiAgICBjb25zb2xlLmxvZyhcImdldE1lc3NhZ2VCeUlkXCIsIGlkLCByZXMpO1xuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgX2RlZmF1bHRVcHNlcnRNZXNzYWdlKFxuICAgIG1lc3NhZ2U6IHR5cGVzLkNoYXRNZXNzYWdlXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIGNvbnNvbGUubG9nKFwiPT0+dXBzZXJ0TWVzc2FnZT5cIiwgbWVzc2FnZS5pZCwgbWVzc2FnZSk7XG4gICAgYXdhaXQgdGhpcy5fbWVzc2FnZVN0b3JlLnNldChtZXNzYWdlLmlkLCBtZXNzYWdlKTtcbiAgfVxufVxuIl19