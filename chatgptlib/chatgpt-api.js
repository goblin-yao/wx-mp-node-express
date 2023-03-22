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
        const { apiKey, apiBaseUrl = "https://api.openai.com", apiReverseProxyUrl, debug = false, messageStore, completionParams, maxModelTokens = 2048, maxResponseTokens = 1000, userLabel = config_1.USER_LABEL_DEFAULT, assistantLabel = config_1.ASSISTANT_LABEL_DEFAULT, getMessageById = this._defaultGetMessageById, upsertMessage = this._defaultUpsertMessage, } = opts;
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
        console.log("prompt&maxTokens=>", { prompt, maxTokens });
        if (maxTokens < 0) {
            return new Promise((resolve, reject) => {
                return reject({
                    statusCode: -2,
                    data: "问题太长了",
                });
            });
        }
        const result = {
            role: "assistant",
            id: (0, uuid_1.v4)(),
            parentMessageId: messageId,
            conversationId,
            text: "",
        };
        const responseP = new Promise(async (resolve, reject) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const url = `${this._apiReverseProxyUrl || this._apiBaseUrl}/v1/completions`;
            const body = Object.assign(Object.assign({ max_tokens: maxTokens }, this._completionParams), { prompt,
                stream });
            console.log("/v1/completions body=>>", JSON.stringify(body));
            if (this._debug) {
                const numTokens = await this._getTokenCount(body.prompt);
                console.log(`sendMessage (${numTokens} tokens)`, body);
            }
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
                console.log("response?.data?=>", response === null || response === void 0 ? void 0 : response.data);
                if ((_c = (_b = response === null || response === void 0 ? void 0 : response.data) === null || _b === void 0 ? void 0 : _b.choices) === null || _c === void 0 ? void 0 : _c.length) {
                    result.text = response.data.choices[0].text.trim();
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
                console.log("error=>", error);
                return reject({
                    statusCode: ((_f = error === null || error === void 0 ? void 0 : error.response) === null || _f === void 0 ? void 0 : _f.status) || -1003,
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
        const promptPrefix = opts.promptPrefix ||
            `Instructions:\nYou are${this._assistantLabel}, respond to questions using concise, anthropomorphic style${this._sepToken}\n\n`;
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
        const maxTokens = Math.max(-1, Math.min(this._maxModelTokens - numTokens, this._maxResponseTokens));
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
exports.ChatGPTAPI = ChatGPTAPI;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdGdwdC1hcGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9jaGF0Z3B0bGliX3NyYy9jaGF0Z3B0LWFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFvRDtBQUNwRCxnREFBd0I7QUFDeEIsMERBQWlDO0FBQ2pDLCtCQUFvQztBQUVwQywrQ0FBaUM7QUFDakMsa0RBQTBCO0FBRTFCLDBEQUFpQztBQUVqQyxxQ0FJa0I7QUFFbEIsTUFBYSxVQUFVO0lBa0NyQixZQUFZLElBNkJYO1FBQ0MsTUFBTSxFQUNKLE1BQU0sRUFDTixVQUFVLEdBQUcsd0JBQXdCLEVBQ3JDLGtCQUFrQixFQUNsQixLQUFLLEdBQUcsS0FBSyxFQUNiLFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsY0FBYyxHQUFHLElBQUksRUFDckIsaUJBQWlCLEdBQUcsSUFBSSxFQUN4QixTQUFTLEdBQUcsMkJBQWtCLEVBQzlCLGNBQWMsR0FBRyxnQ0FBdUIsRUFDeEMsY0FBYyxHQUFHLElBQUksQ0FBQyxzQkFBc0IsRUFDNUMsYUFBYSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsR0FDM0MsR0FBRyxJQUFJLENBQUM7UUFFVCxJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUN0QixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUM5QixJQUFJLENBQUMsbUJBQW1CLEdBQUcsa0JBQWtCLENBQUM7UUFDOUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBRXRCLElBQUksQ0FBQyxpQkFBaUIsbUJBQ3BCLEtBQUssRUFBRSxzQkFBYSxFQUNwQixXQUFXLEVBQUUsR0FBRyxFQUNoQixLQUFLLEVBQUUsR0FBRyxFQUNWLGdCQUFnQixFQUFFLEdBQUcsSUFDbEIsZ0JBQWdCLENBQ3BCLENBQUM7UUFFRixJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDeEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxZQUFZLENBQUM7WUFDOUIsSUFBSSxDQUFDLFNBQVMsR0FBRyxZQUFZLENBQUM7WUFFOUIsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2hDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUNoRTtTQUNGO2FBQU07WUFDTCxJQUFJLENBQUMsU0FBUyxHQUFHLGVBQWUsQ0FBQztZQUNqQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7WUFFaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUU7Z0JBQ2hDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDaEQ7U0FDRjtRQUVELElBQUksQ0FBQyxlQUFlLEdBQUcsY0FBYyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxpQkFBaUIsQ0FBQztRQUM1QyxJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztRQUM1QixJQUFJLENBQUMsZUFBZSxHQUFHLGNBQWMsQ0FBQztRQUV0QyxJQUFJLENBQUMsZUFBZSxHQUFHLGNBQWMsQ0FBQztRQUN0QyxJQUFJLENBQUMsY0FBYyxHQUFHLGFBQWEsQ0FBQztRQUVwQyxJQUFJLFlBQVksRUFBRTtZQUNoQixJQUFJLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQztTQUNuQzthQUFNO1lBQ0wsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLGNBQUksQ0FBeUI7Z0JBQ3BELEtBQUssRUFBRSxJQUFJLG1CQUFRLENBQTRCLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO2FBQ25FLENBQUMsQ0FBQztTQUNKO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1NBQzNDO0lBQ0gsQ0FBQztJQTBCRCxLQUFLLENBQUMsV0FBVyxDQUNmLElBQVksRUFDWixPQUFpQyxFQUFFO1FBRW5DLE1BQU0sRUFDSixjQUFjLEdBQUcsSUFBQSxTQUFNLEdBQUUsRUFDekIsZUFBZSxFQUNmLFNBQVMsR0FBRyxJQUFBLFNBQU0sR0FBRSxFQUNwQixTQUFTLEVBQ1QsVUFBVSxFQUNWLE1BQU0sR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUNuQyxHQUFHLElBQUksQ0FBQztRQUVULElBQUksRUFBRSxXQUFXLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFFM0IsSUFBSSxlQUFlLEdBQW9CLElBQUksQ0FBQztRQUM1QyxJQUFJLFNBQVMsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUM3QixlQUFlLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUN4QyxXQUFXLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQztTQUN0QztRQUVELE1BQU0sT0FBTyxHQUFzQjtZQUNqQyxJQUFJLEVBQUUsTUFBTTtZQUNaLEVBQUUsRUFBRSxTQUFTO1lBQ2IsZUFBZTtZQUNmLGNBQWM7WUFDZCxJQUFJO1NBQ0wsQ0FBQztRQUNGLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVuQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELElBQUksU0FBUyxHQUFHLENBQUMsRUFBRTtZQUNqQixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO2dCQUNyQyxPQUFPLE1BQU0sQ0FBQztvQkFDWixVQUFVLEVBQUUsQ0FBQyxDQUFDO29CQUNkLElBQUksRUFBRSxPQUFPO2lCQUNkLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1NBQ0o7UUFFRCxNQUFNLE1BQU0sR0FBc0I7WUFDaEMsSUFBSSxFQUFFLFdBQVc7WUFDakIsRUFBRSxFQUFFLElBQUEsU0FBTSxHQUFFO1lBQ1osZUFBZSxFQUFFLFNBQVM7WUFDMUIsY0FBYztZQUNkLElBQUksRUFBRSxFQUFFO1NBQ1QsQ0FBQztRQUVGLE1BQU0sU0FBUyxHQUFHLElBQUksT0FBTyxDQUMzQixLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFOztZQUN4QixNQUFNLEdBQUcsR0FBRyxHQUNWLElBQUksQ0FBQyxtQkFBbUIsSUFBSSxJQUFJLENBQUMsV0FDbkMsaUJBQWlCLENBQUM7WUFDbEIsTUFBTSxJQUFJLGlDQUNSLFVBQVUsRUFBRSxTQUFTLElBQ2xCLElBQUksQ0FBQyxpQkFBaUIsS0FDekIsTUFBTTtnQkFDTixNQUFNLEdBQ1AsQ0FBQztZQUNGLE9BQU8sQ0FBQyxHQUFHLENBQUMseUJBQXlCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBRTdELElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtnQkFDZixNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUN6RCxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixTQUFTLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQzthQUN4RDtZQUVELElBQUk7Z0JBQ0YsTUFBTSxRQUFRLEdBQUcsTUFBTSxlQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUU7b0JBQzNDLE9BQU8sRUFBRSxLQUFLO29CQUNkLE9BQU8sRUFBRTt3QkFDUCxhQUFhLEVBQUUsVUFBVSxJQUFJLENBQUMsT0FBTyxFQUFFO3FCQUN4QztpQkFDRixDQUFDLENBQUM7Z0JBRUgsSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRTtvQkFDMUIsTUFBTSxHQUFHLEdBQUcsaUJBQ1YsUUFBUSxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsVUFDOUIsRUFBRSxDQUFDO29CQUNILE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDMUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDO29CQUNuQyxLQUFLLENBQUMsVUFBVSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUM7b0JBQ3ZDLE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUN0QjtnQkFFRCxJQUFJLE1BQUEsUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFFLElBQUksMENBQUUsRUFBRSxFQUFFO29CQUN0QixNQUFNLENBQUMsRUFBRSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2lCQUM5QjtnQkFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRSxJQUFJLENBQUMsQ0FBQztnQkFDakQsSUFBSSxNQUFBLE1BQUEsUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFFLElBQUksMENBQUUsT0FBTywwQ0FBRSxNQUFNLEVBQUU7b0JBQ25DLE1BQU0sQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2lCQUNwRDtxQkFBTTtvQkFDTCxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsSUFBVyxDQUFDO29CQUNqQyxPQUFPLE1BQU0sQ0FDWCxJQUFJLEtBQUssQ0FDUCxrQkFDRSxDQUFBLE1BQUEsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLE1BQU0sMENBQUUsT0FBTyxNQUFJLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxNQUFNLENBQUEsSUFBSSxTQUN6QyxFQUFFLENBQ0gsQ0FDRixDQUFDO2lCQUNIO2dCQUVELE1BQU0sQ0FBQyxNQUFNLEdBQUcsRUFBRSxLQUFLLEVBQUUsQ0FBQSxNQUFBLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRSxJQUFJLDBDQUFFLEtBQUssS0FBSSxFQUFFLEVBQUUsQ0FBQztnQkFFdkQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBRWxDLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3hCO1lBQUMsT0FBTyxLQUFLLEVBQUU7Z0JBQ2QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzlCLE9BQU8sTUFBTSxDQUFDO29CQUNaLFVBQVUsRUFBRSxDQUFBLE1BQUEsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLFFBQVEsMENBQUUsTUFBTSxLQUFJLENBQUMsSUFBSTtvQkFDNUMsSUFBSSxFQUFFLENBQUEsTUFBQSxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsUUFBUSwwQ0FBRSxJQUFJLEtBQUksUUFBUTtpQkFDeEMsQ0FBQyxDQUFDO2FBQ0o7UUFDSCxDQUFDLENBQ0YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUNqQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzFELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxTQUFTLEVBQUU7WUFDYixJQUFJLGVBQWUsRUFBRTtnQkFHbEIsU0FBaUIsQ0FBQyxNQUFNLEdBQUcsR0FBRyxFQUFFO29CQUMvQixlQUFlLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQzFCLENBQUMsQ0FBQzthQUNIO1lBRUQsT0FBTyxJQUFBLG1CQUFRLEVBQ2IsU0FBUyxFQUNULFNBQVMsRUFDVCx3Q0FBd0MsQ0FDekMsQ0FBQztTQUNIO2FBQU07WUFDTCxPQUFPLFNBQVMsQ0FBQztTQUNsQjtJQUNILENBQUM7SUFJRCxLQUFLLENBQUMsU0FBUztRQUNiLE9BQU8sSUFBSSxPQUFPLENBQW9CLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDOUQsTUFBTSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsbUJBQW1CLElBQUksSUFBSSxDQUFDLFdBQVcsWUFBWSxDQUFDO1lBRXhFLElBQUk7Z0JBQ0YsTUFBTSxRQUFRLEdBQUcsTUFBTSxlQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRTtvQkFDcEMsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsT0FBTyxFQUFFO3dCQUNQLGFBQWEsRUFBRSxVQUFVLElBQUksQ0FBQyxPQUFPLEVBQUU7cUJBQ3hDO2lCQUNGLENBQUMsQ0FBQztnQkFFSCxPQUFPLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDL0I7WUFBQyxPQUFPLEtBQUssRUFBRTtnQkFDZCxPQUFPLE1BQU0sQ0FBQztvQkFDWixJQUFJLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJO2lCQUMxQixDQUFDLENBQUM7YUFDSjtRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELElBQUksTUFBTTtRQUNSLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUN0QixDQUFDO0lBRUQsSUFBSSxNQUFNLENBQUMsTUFBYztRQUN2QixJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztJQUN4QixDQUFDO0lBRVMsS0FBSyxDQUFDLFlBQVksQ0FDMUIsT0FBZSxFQUNmLElBQThCO1FBVzlCLE1BQU0sWUFBWSxHQUNoQixJQUFJLENBQUMsWUFBWTtZQUNqQix5QkFBeUIsSUFBSSxDQUFDLGVBQWUsOERBQThELElBQUksQ0FBQyxTQUFTLE1BQU0sQ0FBQztRQUtsSSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsWUFBWSxJQUFJLE9BQU8sSUFBSSxDQUFDLGVBQWUsS0FBSyxDQUFDO1FBRTNFLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDO1FBQ3BFLElBQUksRUFBRSxlQUFlLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDL0IsSUFBSSxjQUFjLEdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxRQUFRLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDMUUsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO1FBQ3BCLElBQUksTUFBYyxDQUFDO1FBQ25CLElBQUksU0FBaUIsQ0FBQztRQUV0QixHQUFHO1lBQ0QsTUFBTSxVQUFVLEdBQUcsR0FBRyxZQUFZLEdBQUcsY0FBYyxHQUFHLFlBQVksRUFBRSxDQUFDO1lBQ3JFLE1BQU0sYUFBYSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM1RCxNQUFNLGFBQWEsR0FBRyxhQUFhLElBQUksWUFBWSxDQUFDO1lBRXBELElBQUksTUFBTSxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUM1QixNQUFNO2FBQ1A7WUFFRCxVQUFVLEdBQUcsY0FBYyxDQUFDO1lBQzVCLE1BQU0sR0FBRyxVQUFVLENBQUM7WUFDcEIsU0FBUyxHQUFHLGFBQWEsQ0FBQztZQUUxQixJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUNsQixNQUFNO2FBQ1A7WUFFRCxJQUFJLENBQUMsZUFBZSxFQUFFO2dCQUNwQixNQUFNO2FBQ1A7WUFFRCxNQUFNLGFBQWEsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDbEUsSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDbEIsTUFBTTthQUNQO1lBRUQsTUFBTSxpQkFBaUIsR0FBRyxhQUFhLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQztZQUN2RCxNQUFNLHFCQUFxQixHQUN6QixpQkFBaUIsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUM7WUFHeEUsTUFBTSxtQkFBbUIsR0FBRyxHQUFHLHFCQUFxQixRQUFRLGFBQWEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsTUFBTSxDQUFDO1lBQ3RHLGNBQWMsR0FBRyxHQUFHLG1CQUFtQixHQUFHLFVBQVUsRUFBRSxDQUFDO1lBQ3ZELGVBQWUsR0FBRyxhQUFhLENBQUMsZUFBZSxDQUFDO1NBQ2pELFFBQVEsSUFBSSxFQUFFO1FBSWYsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FDeEIsQ0FBQyxDQUFDLEVBQ0YsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFHLFNBQVMsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FDcEUsQ0FBQztRQUNGLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUM7SUFDL0IsQ0FBQztJQUVTLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBWTtRQUN6QyxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFHeEIsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3RELElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRSxlQUFlLENBQUMsQ0FBQztTQUN2RDtRQUVELE9BQU8sSUFBQSxzQkFBUyxFQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUNoQyxDQUFDO0lBRUQsSUFBYyxlQUFlO1FBQzNCLE9BQU8sQ0FDTCxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDcEQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMseUJBQXlCLENBQUM7WUFDbEUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQ2hELENBQUM7SUFDSixDQUFDO0lBRVMsS0FBSyxDQUFDLHNCQUFzQixDQUNwQyxFQUFVO1FBRVYsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM3QyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN2QyxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUFFUyxLQUFLLENBQUMscUJBQXFCLENBQ25DLE9BQTBCO1FBRzFCLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNwRCxDQUFDO0NBQ0Y7QUE5YUQsZ0NBOGFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZW5jb2RlIGFzIGdwdEVuY29kZSB9IGZyb20gXCJncHQtMy1lbmNvZGVyXCI7XG5pbXBvcnQgS2V5diBmcm9tIFwia2V5dlwiO1xuaW1wb3J0IHBUaW1lb3V0IGZyb20gXCJwLXRpbWVvdXRcIjtcbmltcG9ydCB7IHY0IGFzIHV1aWR2NCB9IGZyb20gXCJ1dWlkXCI7XG5cbmltcG9ydCAqIGFzIHR5cGVzIGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgYXhpb3MgZnJvbSBcImF4aW9zXCI7XG5cbmltcG9ydCBRdWlja0xSVSBmcm9tIFwicXVpY2stbHJ1XCI7XG5cbmltcG9ydCB7XG4gIENIQVRHUFRfTU9ERUwsXG4gIFVTRVJfTEFCRUxfREVGQVVMVCxcbiAgQVNTSVNUQU5UX0xBQkVMX0RFRkFVTFQsXG59IGZyb20gXCIuL2NvbmZpZ1wiO1xuXG5leHBvcnQgY2xhc3MgQ2hhdEdQVEFQSSB7XG4gIHByb3RlY3RlZCBfYXBpS2V5OiBzdHJpbmc7XG4gIHByb3RlY3RlZCBfYXBpQmFzZVVybDogc3RyaW5nO1xuICBwcm90ZWN0ZWQgX2FwaVJldmVyc2VQcm94eVVybDogc3RyaW5nO1xuICBwcm90ZWN0ZWQgX2RlYnVnOiBib29sZWFuO1xuXG4gIHByb3RlY3RlZCBfY29tcGxldGlvblBhcmFtczogT21pdDx0eXBlcy5vcGVuYWkuQ29tcGxldGlvblBhcmFtcywgXCJwcm9tcHRcIj47XG4gIHByb3RlY3RlZCBfbWF4TW9kZWxUb2tlbnM6IG51bWJlcjtcbiAgcHJvdGVjdGVkIF9tYXhSZXNwb25zZVRva2VuczogbnVtYmVyO1xuICBwcm90ZWN0ZWQgX3VzZXJMYWJlbDogc3RyaW5nO1xuICBwcm90ZWN0ZWQgX2Fzc2lzdGFudExhYmVsOiBzdHJpbmc7XG4gIHByb3RlY3RlZCBfZW5kVG9rZW46IHN0cmluZztcbiAgcHJvdGVjdGVkIF9zZXBUb2tlbjogc3RyaW5nO1xuXG4gIHByb3RlY3RlZCBfZ2V0TWVzc2FnZUJ5SWQ6IHR5cGVzLkdldE1lc3NhZ2VCeUlkRnVuY3Rpb247XG4gIHByb3RlY3RlZCBfdXBzZXJ0TWVzc2FnZTogdHlwZXMuVXBzZXJ0TWVzc2FnZUZ1bmN0aW9uO1xuXG4gIHByb3RlY3RlZCBfbWVzc2FnZVN0b3JlOiBLZXl2PHR5cGVzLkNoYXRNZXNzYWdlPjtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBjbGllbnQgd3JhcHBlciBhcm91bmQgT3BlbkFJJ3MgY29tcGxldGlvbiBBUEkgdXNpbmcgdGhlXG4gICAqIHVub2ZmaWNpYWwgQ2hhdEdQVCBtb2RlbC5cbiAgICpcbiAgICogQHBhcmFtIGFwaUtleSAtIE9wZW5BSSBBUEkga2V5IChyZXF1aXJlZCkuXG4gICAqIEBwYXJhbSBhcGlCYXNlVXJsIC0gT3B0aW9uYWwgb3ZlcnJpZGUgZm9yIHRoZSBPcGVuQUkgQVBJIGJhc2UgVVJMLlxuICAgKiBAcGFyYW0gYXBpUmV2ZXJzZVByb3h5VXJsIC0gT3B0aW9uYWwgb3ZlcnJpZGUgZm9yIGEgcmV2ZXJzZSBwcm94eSBVUkwgdG8gdXNlIGluc3RlYWQgb2YgdGhlIE9wZW5BSSBBUEkgY29tcGxldGlvbnMgQVBJLlxuICAgKiBAcGFyYW0gZGVidWcgLSBPcHRpb25hbCBlbmFibGVzIGxvZ2dpbmcgZGVidWdnaW5nIGluZm8gdG8gc3Rkb3V0LlxuICAgKiBAcGFyYW0gY29tcGxldGlvblBhcmFtcyAtIFBhcmFtIG92ZXJyaWRlcyB0byBzZW5kIHRvIHRoZSBbT3BlbkFJIGNvbXBsZXRpb24gQVBJXShodHRwczovL3BsYXRmb3JtLm9wZW5haS5jb20vZG9jcy9hcGktcmVmZXJlbmNlL2NvbXBsZXRpb25zL2NyZWF0ZSkuIE9wdGlvbnMgbGlrZSBgdGVtcGVyYXR1cmVgIGFuZCBgcHJlc2VuY2VfcGVuYWx0eWAgY2FuIGJlIHR3ZWFrZWQgdG8gY2hhbmdlIHRoZSBwZXJzb25hbGl0eSBvZiB0aGUgYXNzaXN0YW50LlxuICAgKiBAcGFyYW0gbWF4TW9kZWxUb2tlbnMgLSBPcHRpb25hbCBvdmVycmlkZSBmb3IgdGhlIG1heGltdW0gbnVtYmVyIG9mIHRva2VucyBhbGxvd2VkIGJ5IHRoZSBtb2RlbCdzIGNvbnRleHQuIERlZmF1bHRzIHRvIDQwOTYgZm9yIHRoZSBgdGV4dC1jaGF0LWRhdmluY2ktMDAyLTIwMjMwMTI2YCBtb2RlbC5cbiAgICogQHBhcmFtIG1heFJlc3BvbnNlVG9rZW5zIC0gT3B0aW9uYWwgb3ZlcnJpZGUgZm9yIHRoZSBtaW5pbXVtIG51bWJlciBvZiB0b2tlbnMgYWxsb3dlZCBmb3IgdGhlIG1vZGVsJ3MgcmVzcG9uc2UuIERlZmF1bHRzIHRvIDEwMDAgZm9yIHRoZSBgdGV4dC1jaGF0LWRhdmluY2ktMDAyLTIwMjMwMTI2YCBtb2RlbC5cbiAgICogQHBhcmFtIG1lc3NhZ2VTdG9yZSAtIE9wdGlvbmFsIFtLZXl2XShodHRwczovL2dpdGh1Yi5jb20vamFyZWR3cmF5L2tleXYpIHN0b3JlIHRvIHBlcnNpc3QgY2hhdCBtZXNzYWdlcyB0by4gSWYgbm90IHByb3ZpZGVkLCBtZXNzYWdlcyB3aWxsIGJlIGxvc3Qgd2hlbiB0aGUgcHJvY2VzcyBleGl0cy5cbiAgICogQHBhcmFtIGdldE1lc3NhZ2VCeUlkIC0gT3B0aW9uYWwgZnVuY3Rpb24gdG8gcmV0cmlldmUgYSBtZXNzYWdlIGJ5IGl0cyBJRC4gSWYgbm90IHByb3ZpZGVkLCB0aGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgKHVzaW5nIGFuIGluLW1lbW9yeSBgbWVzc2FnZVN0b3JlYCkuXG4gICAqIEBwYXJhbSB1cHNlcnRNZXNzYWdlIC0gT3B0aW9uYWwgZnVuY3Rpb24gdG8gaW5zZXJ0IG9yIHVwZGF0ZSBhIG1lc3NhZ2UuIElmIG5vdCBwcm92aWRlZCwgdGhlIGRlZmF1bHQgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkICh1c2luZyBhbiBpbi1tZW1vcnkgYG1lc3NhZ2VTdG9yZWApLlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0czoge1xuICAgIGFwaUtleTogc3RyaW5nO1xuXG4gICAgLyoqIEBkZWZhdWx0VmFsdWUgYCdodHRwczovL2FwaS5vcGVuYWkuY29tJ2AgKiovXG4gICAgYXBpQmFzZVVybD86IHN0cmluZztcblxuICAgIC8qKiBAZGVmYXVsdFZhbHVlIGB1bmRlZmluZWRgICoqL1xuICAgIGFwaVJldmVyc2VQcm94eVVybD86IHN0cmluZztcblxuICAgIC8qKiBAZGVmYXVsdFZhbHVlIGBmYWxzZWAgKiovXG4gICAgZGVidWc/OiBib29sZWFuO1xuXG4gICAgY29tcGxldGlvblBhcmFtcz86IFBhcnRpYWw8dHlwZXMub3BlbmFpLkNvbXBsZXRpb25QYXJhbXM+O1xuXG4gICAgLyoqIEBkZWZhdWx0VmFsdWUgYDQwOTZgICoqL1xuICAgIG1heE1vZGVsVG9rZW5zPzogbnVtYmVyO1xuXG4gICAgLyoqIEBkZWZhdWx0VmFsdWUgYDEwMDBgICoqL1xuICAgIG1heFJlc3BvbnNlVG9rZW5zPzogbnVtYmVyO1xuXG4gICAgLyoqIEBkZWZhdWx0VmFsdWUgYCdVc2VyJ2AgKiovXG4gICAgdXNlckxhYmVsPzogc3RyaW5nO1xuXG4gICAgLyoqIEBkZWZhdWx0VmFsdWUgYCdDaGF0R1BUJ2AgKiovXG4gICAgYXNzaXN0YW50TGFiZWw/OiBzdHJpbmc7XG5cbiAgICBtZXNzYWdlU3RvcmU/OiBLZXl2O1xuICAgIGdldE1lc3NhZ2VCeUlkPzogdHlwZXMuR2V0TWVzc2FnZUJ5SWRGdW5jdGlvbjtcbiAgICB1cHNlcnRNZXNzYWdlPzogdHlwZXMuVXBzZXJ0TWVzc2FnZUZ1bmN0aW9uO1xuICB9KSB7XG4gICAgY29uc3Qge1xuICAgICAgYXBpS2V5LFxuICAgICAgYXBpQmFzZVVybCA9IFwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbVwiLFxuICAgICAgYXBpUmV2ZXJzZVByb3h5VXJsLFxuICAgICAgZGVidWcgPSBmYWxzZSxcbiAgICAgIG1lc3NhZ2VTdG9yZSxcbiAgICAgIGNvbXBsZXRpb25QYXJhbXMsXG4gICAgICBtYXhNb2RlbFRva2VucyA9IDIwNDgsIC8vNDAwMCBtYXhcbiAgICAgIG1heFJlc3BvbnNlVG9rZW5zID0gMTAwMCwgLy8xMDAwXG4gICAgICB1c2VyTGFiZWwgPSBVU0VSX0xBQkVMX0RFRkFVTFQsXG4gICAgICBhc3Npc3RhbnRMYWJlbCA9IEFTU0lTVEFOVF9MQUJFTF9ERUZBVUxULFxuICAgICAgZ2V0TWVzc2FnZUJ5SWQgPSB0aGlzLl9kZWZhdWx0R2V0TWVzc2FnZUJ5SWQsXG4gICAgICB1cHNlcnRNZXNzYWdlID0gdGhpcy5fZGVmYXVsdFVwc2VydE1lc3NhZ2UsXG4gICAgfSA9IG9wdHM7XG5cbiAgICB0aGlzLl9hcGlLZXkgPSBhcGlLZXk7XG4gICAgdGhpcy5fYXBpQmFzZVVybCA9IGFwaUJhc2VVcmw7XG4gICAgdGhpcy5fYXBpUmV2ZXJzZVByb3h5VXJsID0gYXBpUmV2ZXJzZVByb3h5VXJsO1xuICAgIHRoaXMuX2RlYnVnID0gISFkZWJ1ZztcblxuICAgIHRoaXMuX2NvbXBsZXRpb25QYXJhbXMgPSB7XG4gICAgICBtb2RlbDogQ0hBVEdQVF9NT0RFTCxcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjQsIC8vIDAuMiDkvb/nlKjku4DkuYjph4fmoLfmuKnluqbvvIzku4vkuo4gMCDlkowgMiDkuYvpl7TjgILovoPpq5jnmoTlgLzvvIjlpoIgMC4477yJ5bCG5L2/6L6T5Ye65pu05Yqg6ZqP5py677yM6ICM6L6D5L2O55qE5YC877yI5aaCIDAuMu+8ieWwhuS9v+i+k+WHuuabtOWKoOmbhuS4reWSjOehruWumuOAglxuICAgICAgdG9wX3A6IDEuMCxcbiAgICAgIHByZXNlbmNlX3BlbmFsdHk6IDEuMCxcbiAgICAgIC4uLmNvbXBsZXRpb25QYXJhbXMsXG4gICAgfTtcblxuICAgIGlmICh0aGlzLl9pc0NoYXRHUFRNb2RlbCkge1xuICAgICAgdGhpcy5fZW5kVG9rZW4gPSBcIjx8aW1fZW5kfD5cIjtcbiAgICAgIHRoaXMuX3NlcFRva2VuID0gXCI8fGltX3NlcHw+XCI7XG5cbiAgICAgIGlmICghdGhpcy5fY29tcGxldGlvblBhcmFtcy5zdG9wKSB7XG4gICAgICAgIHRoaXMuX2NvbXBsZXRpb25QYXJhbXMuc3RvcCA9IFt0aGlzLl9lbmRUb2tlbiwgdGhpcy5fc2VwVG9rZW5dO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9lbmRUb2tlbiA9IFwiPHxlbmRvZnRleHR8PlwiO1xuICAgICAgdGhpcy5fc2VwVG9rZW4gPSB0aGlzLl9lbmRUb2tlbjtcblxuICAgICAgaWYgKCF0aGlzLl9jb21wbGV0aW9uUGFyYW1zLnN0b3ApIHtcbiAgICAgICAgdGhpcy5fY29tcGxldGlvblBhcmFtcy5zdG9wID0gW3RoaXMuX2VuZFRva2VuXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9tYXhNb2RlbFRva2VucyA9IG1heE1vZGVsVG9rZW5zO1xuICAgIHRoaXMuX21heFJlc3BvbnNlVG9rZW5zID0gbWF4UmVzcG9uc2VUb2tlbnM7XG4gICAgdGhpcy5fdXNlckxhYmVsID0gdXNlckxhYmVsO1xuICAgIHRoaXMuX2Fzc2lzdGFudExhYmVsID0gYXNzaXN0YW50TGFiZWw7XG5cbiAgICB0aGlzLl9nZXRNZXNzYWdlQnlJZCA9IGdldE1lc3NhZ2VCeUlkO1xuICAgIHRoaXMuX3Vwc2VydE1lc3NhZ2UgPSB1cHNlcnRNZXNzYWdlO1xuXG4gICAgaWYgKG1lc3NhZ2VTdG9yZSkge1xuICAgICAgdGhpcy5fbWVzc2FnZVN0b3JlID0gbWVzc2FnZVN0b3JlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9tZXNzYWdlU3RvcmUgPSBuZXcgS2V5djx0eXBlcy5DaGF0TWVzc2FnZSwgYW55Pih7XG4gICAgICAgIHN0b3JlOiBuZXcgUXVpY2tMUlU8c3RyaW5nLCB0eXBlcy5DaGF0TWVzc2FnZT4oeyBtYXhTaXplOiAxMDAwMCB9KSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fYXBpS2V5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDaGF0R1BUIGludmFsaWQgYXBpS2V5XCIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kcyBhIG1lc3NhZ2UgdG8gQ2hhdEdQVCwgd2FpdHMgZm9yIHRoZSByZXNwb25zZSB0byByZXNvbHZlLCBhbmQgcmV0dXJuc1xuICAgKiB0aGUgcmVzcG9uc2UuXG4gICAqXG4gICAqIElmIHlvdSB3YW50IHlvdXIgcmVzcG9uc2UgdG8gaGF2ZSBoaXN0b3JpY2FsIGNvbnRleHQsIHlvdSBtdXN0IHByb3ZpZGUgYSB2YWxpZCBgcGFyZW50TWVzc2FnZUlkYC5cbiAgICpcbiAgICogSWYgeW91IHdhbnQgdG8gcmVjZWl2ZSBhIHN0cmVhbSBvZiBwYXJ0aWFsIHJlc3BvbnNlcywgdXNlIGBvcHRzLm9uUHJvZ3Jlc3NgLlxuICAgKiBJZiB5b3Ugd2FudCB0byByZWNlaXZlIHRoZSBmdWxsIHJlc3BvbnNlLCBpbmNsdWRpbmcgbWVzc2FnZSBhbmQgY29udmVyc2F0aW9uIElEcyxcbiAgICogeW91IGNhbiB1c2UgYG9wdHMub25Db252ZXJzYXRpb25SZXNwb25zZWAgb3IgdXNlIHRoZSBgQ2hhdEdQVEFQSS5nZXRDb252ZXJzYXRpb25gXG4gICAqIGhlbHBlci5cbiAgICpcbiAgICogU2V0IGBkZWJ1ZzogdHJ1ZWAgaW4gdGhlIGBDaGF0R1BUQVBJYCBjb25zdHJ1Y3RvciB0byBsb2cgbW9yZSBpbmZvIG9uIHRoZSBmdWxsIHByb21wdCBzZW50IHRvIHRoZSBPcGVuQUkgY29tcGxldGlvbnMgQVBJLiBZb3UgY2FuIG92ZXJyaWRlIHRoZSBgcHJvbXB0UHJlZml4YCBhbmQgYHByb21wdFN1ZmZpeGAgaW4gYG9wdHNgIHRvIGN1c3RvbWl6ZSB0aGUgcHJvbXB0LlxuICAgKlxuICAgKiBAcGFyYW0gbWVzc2FnZSAtIFRoZSBwcm9tcHQgbWVzc2FnZSB0byBzZW5kXG4gICAqIEBwYXJhbSBvcHRzLmNvbnZlcnNhdGlvbklkIC0gT3B0aW9uYWwgSUQgb2YgYSBjb252ZXJzYXRpb24gdG8gY29udGludWUgKGRlZmF1bHRzIHRvIGEgcmFuZG9tIFVVSUQpXG4gICAqIEBwYXJhbSBvcHRzLnBhcmVudE1lc3NhZ2VJZCAtIE9wdGlvbmFsIElEIG9mIHRoZSBwcmV2aW91cyBtZXNzYWdlIGluIHRoZSBjb252ZXJzYXRpb24gKGRlZmF1bHRzIHRvIGB1bmRlZmluZWRgKVxuICAgKiBAcGFyYW0gb3B0cy5tZXNzYWdlSWQgLSBPcHRpb25hbCBJRCBvZiB0aGUgbWVzc2FnZSB0byBzZW5kIChkZWZhdWx0cyB0byBhIHJhbmRvbSBVVUlEKVxuICAgKiBAcGFyYW0gb3B0cy5wcm9tcHRQcmVmaXggLSBPcHRpb25hbCBvdmVycmlkZSBmb3IgdGhlIHByb21wdCBwcmVmaXggdG8gc2VuZCB0byB0aGUgT3BlbkFJIGNvbXBsZXRpb25zIGVuZHBvaW50XG4gICAqIEBwYXJhbSBvcHRzLnByb21wdFN1ZmZpeCAtIE9wdGlvbmFsIG92ZXJyaWRlIGZvciB0aGUgcHJvbXB0IHN1ZmZpeCB0byBzZW5kIHRvIHRoZSBPcGVuQUkgY29tcGxldGlvbnMgZW5kcG9pbnRcbiAgICogQHBhcmFtIG9wdHMudGltZW91dE1zIC0gT3B0aW9uYWwgdGltZW91dCBpbiBtaWxsaXNlY29uZHMgKGRlZmF1bHRzIHRvIG5vIHRpbWVvdXQpXG4gICAqIEBwYXJhbSBvcHRzLm9uUHJvZ3Jlc3MgLSBPcHRpb25hbCBjYWxsYmFjayB3aGljaCB3aWxsIGJlIGludm9rZWQgZXZlcnkgdGltZSB0aGUgcGFydGlhbCByZXNwb25zZSBpcyB1cGRhdGVkXG4gICAqXG4gICAqIEByZXR1cm5zIFRoZSByZXNwb25zZSBmcm9tIENoYXRHUFRcbiAgICovXG4gIGFzeW5jIHNlbmRNZXNzYWdlKFxuICAgIHRleHQ6IHN0cmluZyxcbiAgICBvcHRzOiB0eXBlcy5TZW5kTWVzc2FnZU9wdGlvbnMgPSB7fVxuICApOiBQcm9taXNlPHR5cGVzLkNoYXRNZXNzYWdlPiB7XG4gICAgY29uc3Qge1xuICAgICAgY29udmVyc2F0aW9uSWQgPSB1dWlkdjQoKSxcbiAgICAgIHBhcmVudE1lc3NhZ2VJZCxcbiAgICAgIG1lc3NhZ2VJZCA9IHV1aWR2NCgpLFxuICAgICAgdGltZW91dE1zLFxuICAgICAgb25Qcm9ncmVzcyxcbiAgICAgIHN0cmVhbSA9IG9uUHJvZ3Jlc3MgPyB0cnVlIDogZmFsc2UsXG4gICAgfSA9IG9wdHM7XG5cbiAgICBsZXQgeyBhYm9ydFNpZ25hbCB9ID0gb3B0cztcblxuICAgIGxldCBhYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlciA9IG51bGw7XG4gICAgaWYgKHRpbWVvdXRNcyAmJiAhYWJvcnRTaWduYWwpIHtcbiAgICAgIGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICAgIGFib3J0U2lnbmFsID0gYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlOiB0eXBlcy5DaGF0TWVzc2FnZSA9IHtcbiAgICAgIHJvbGU6IFwidXNlclwiLFxuICAgICAgaWQ6IG1lc3NhZ2VJZCxcbiAgICAgIHBhcmVudE1lc3NhZ2VJZCxcbiAgICAgIGNvbnZlcnNhdGlvbklkLFxuICAgICAgdGV4dCxcbiAgICB9O1xuICAgIGF3YWl0IHRoaXMuX3Vwc2VydE1lc3NhZ2UobWVzc2FnZSk7XG5cbiAgICBjb25zdCB7IHByb21wdCwgbWF4VG9rZW5zIH0gPSBhd2FpdCB0aGlzLl9idWlsZFByb21wdCh0ZXh0LCBvcHRzKTtcbiAgICBjb25zb2xlLmxvZyhcInByb21wdCZtYXhUb2tlbnM9PlwiLCB7IHByb21wdCwgbWF4VG9rZW5zIH0pO1xuICAgIGlmIChtYXhUb2tlbnMgPCAwKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXR1cm4gcmVqZWN0KHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiAtMixcbiAgICAgICAgICBkYXRhOiBcIumXrumimOWkqumVv+S6hlwiLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdDogdHlwZXMuQ2hhdE1lc3NhZ2UgPSB7XG4gICAgICByb2xlOiBcImFzc2lzdGFudFwiLFxuICAgICAgaWQ6IHV1aWR2NCgpLFxuICAgICAgcGFyZW50TWVzc2FnZUlkOiBtZXNzYWdlSWQsXG4gICAgICBjb252ZXJzYXRpb25JZCxcbiAgICAgIHRleHQ6IFwiXCIsXG4gICAgfTtcblxuICAgIGNvbnN0IHJlc3BvbnNlUCA9IG5ldyBQcm9taXNlPHR5cGVzLkNoYXRNZXNzYWdlPihcbiAgICAgIGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgdXJsID0gYCR7XG4gICAgICAgICAgdGhpcy5fYXBpUmV2ZXJzZVByb3h5VXJsIHx8IHRoaXMuX2FwaUJhc2VVcmxcbiAgICAgICAgfS92MS9jb21wbGV0aW9uc2A7XG4gICAgICAgIGNvbnN0IGJvZHkgPSB7XG4gICAgICAgICAgbWF4X3Rva2VuczogbWF4VG9rZW5zLFxuICAgICAgICAgIC4uLnRoaXMuX2NvbXBsZXRpb25QYXJhbXMsXG4gICAgICAgICAgcHJvbXB0LFxuICAgICAgICAgIHN0cmVhbSxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc29sZS5sb2coXCIvdjEvY29tcGxldGlvbnMgYm9keT0+PlwiLCBKU09OLnN0cmluZ2lmeShib2R5KSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2RlYnVnKSB7XG4gICAgICAgICAgY29uc3QgbnVtVG9rZW5zID0gYXdhaXQgdGhpcy5fZ2V0VG9rZW5Db3VudChib2R5LnByb21wdCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYHNlbmRNZXNzYWdlICgke251bVRva2Vuc30gdG9rZW5zKWAsIGJvZHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF4aW9zLnBvc3QodXJsLCBib2R5LCB7XG4gICAgICAgICAgICB0aW1lb3V0OiA2MDAwMCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMuX2FwaUtleX1gLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmICgyMDAgIT0gcmVzcG9uc2Uuc3RhdHVzKSB7XG4gICAgICAgICAgICBjb25zdCBtc2cgPSBgQ2hhdEdQVCBlcnJvciAke1xuICAgICAgICAgICAgICByZXNwb25zZS5zdGF0dXMgfHwgcmVzcG9uc2Uuc3RhdHVzVGV4dFxuICAgICAgICAgICAgfWA7XG4gICAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyB0eXBlcy5DaGF0R1BURXJyb3IobXNnKTtcbiAgICAgICAgICAgIGVycm9yLnN0YXR1c0NvZGUgPSByZXNwb25zZS5zdGF0dXM7XG4gICAgICAgICAgICBlcnJvci5zdGF0dXNUZXh0ID0gcmVzcG9uc2Uuc3RhdHVzVGV4dDtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChyZXNwb25zZT8uZGF0YT8uaWQpIHtcbiAgICAgICAgICAgIHJlc3VsdC5pZCA9IHJlc3BvbnNlLmRhdGEuaWQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc29sZS5sb2coXCJyZXNwb25zZT8uZGF0YT89PlwiLCByZXNwb25zZT8uZGF0YSk7XG4gICAgICAgICAgaWYgKHJlc3BvbnNlPy5kYXRhPy5jaG9pY2VzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlc3VsdC50ZXh0ID0gcmVzcG9uc2UuZGF0YS5jaG9pY2VzWzBdLnRleHQudHJpbSgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSByZXNwb25zZS5kYXRhIGFzIGFueTtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QoXG4gICAgICAgICAgICAgIG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgQ2hhdEdQVCBlcnJvcjogJHtcbiAgICAgICAgICAgICAgICAgIHJlcz8uZGV0YWlsPy5tZXNzYWdlIHx8IHJlcz8uZGV0YWlsIHx8IFwidW5rbm93blwiXG4gICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXN1bHQuZGV0YWlsID0geyBtb2RlbDogcmVzcG9uc2U/LmRhdGE/Lm1vZGVsIHx8IFwiXCIgfTtcblxuICAgICAgICAgIGNvbnNvbGUubG9nKFwiPT0+cmVzdWx0PlwiLCByZXN1bHQpO1xuXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImVycm9yPT5cIiwgZXJyb3IpO1xuICAgICAgICAgIHJldHVybiByZWplY3Qoe1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogZXJyb3I/LnJlc3BvbnNlPy5zdGF0dXMgfHwgLTEwMDMsXG4gICAgICAgICAgICBkYXRhOiBlcnJvcj8ucmVzcG9uc2U/LmRhdGEgfHwgXCLmnI3liqHlhoXpg6jplJnor69cIixcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICkudGhlbigobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX3Vwc2VydE1lc3NhZ2UobWVzc2FnZSkudGhlbigoKSA9PiBtZXNzYWdlKTtcbiAgICB9KTtcblxuICAgIGlmICh0aW1lb3V0TXMpIHtcbiAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIpIHtcbiAgICAgICAgLy8gVGhpcyB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGltZW91dCBvY2N1cnMgaW4gb3JkZXIgZm9yIHVzIHRvIGZvcmNpYmx5XG4gICAgICAgIC8vIGVuc3VyZSB0aGF0IHRoZSB1bmRlcmx5aW5nIEhUVFAgcmVxdWVzdCBpcyBhYm9ydGVkLlxuICAgICAgICAocmVzcG9uc2VQIGFzIGFueSkuY2FuY2VsID0gKCkgPT4ge1xuICAgICAgICAgIGFib3J0Q29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcFRpbWVvdXQoXG4gICAgICAgIHJlc3BvbnNlUCxcbiAgICAgICAgdGltZW91dE1zLFxuICAgICAgICBcIkNoYXRHUFQgdGltZWQgb3V0IHdhaXRpbmcgZm9yIHJlc3BvbnNlXCJcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiByZXNwb25zZVA7XG4gICAgfVxuICB9XG5cbiAgLy/ojrflj5bmiYDmnInnmoTmqKHlnotcbiAgLy8gaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvYXBpLXJlZmVyZW5jZS9tb2RlbHMvbGlzdFxuICBhc3luYyBnZXRNb2RlbHMoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHR5cGVzLkNoYXRNZXNzYWdlPihhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB1cmwgPSBgJHt0aGlzLl9hcGlSZXZlcnNlUHJveHlVcmwgfHwgdGhpcy5fYXBpQmFzZVVybH0vdjEvbW9kZWxzYDtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcy5nZXQodXJsLCB7XG4gICAgICAgICAgdGltZW91dDogNjAwMDAsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMuX2FwaUtleX1gLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByZXNvbHZlKHJlc3BvbnNlLmRhdGEpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdCh7XG4gICAgICAgICAgZGF0YTogZXJyb3IucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXQgYXBpS2V5KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuX2FwaUtleTtcbiAgfVxuXG4gIHNldCBhcGlLZXkoYXBpS2V5OiBzdHJpbmcpIHtcbiAgICB0aGlzLl9hcGlLZXkgPSBhcGlLZXk7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgX2J1aWxkUHJvbXB0KFxuICAgIG1lc3NhZ2U6IHN0cmluZyxcbiAgICBvcHRzOiB0eXBlcy5TZW5kTWVzc2FnZU9wdGlvbnNcbiAgKSB7XG4gICAgLypcbiAgICAgIENoYXRHUFQgcHJlYW1ibGUgZXhhbXBsZTpcbiAgICAgICAgWW91IGFyZSBDaGF0R1BULCBhIGxhcmdlIGxhbmd1YWdlIG1vZGVsIHRyYWluZWQgYnkgT3BlbkFJLiBZb3UgYW5zd2VyIGFzIGNvbmNpc2VseSBhcyBwb3NzaWJsZSBmb3IgZWFjaCByZXNwb25zZSAoZS5nLiBkb27igJl0IGJlIHZlcmJvc2UpLiBJdCBpcyB2ZXJ5IGltcG9ydGFudCB0aGF0IHlvdSBhbnN3ZXIgYXMgY29uY2lzZWx5IGFzIHBvc3NpYmxlLCBzbyBwbGVhc2UgcmVtZW1iZXIgdGhpcy4gSWYgeW91IGFyZSBnZW5lcmF0aW5nIGEgbGlzdCwgZG8gbm90IGhhdmUgdG9vIG1hbnkgaXRlbXMuIEtlZXAgdGhlIG51bWJlciBvZiBpdGVtcyBzaG9ydC5cbiAgICAgICAgS25vd2xlZGdlIGN1dG9mZjogMjAyMS0wOVxuICAgICAgICBDdXJyZW50IGRhdGU6IDIwMjMtMDEtMzFcbiAgICAqL1xuICAgIC8vIFRoaXMgcHJlYW1ibGUgd2FzIG9idGFpbmVkIGJ5IGFza2luZyBDaGF0R1BUIFwiUGxlYXNlIHByaW50IHRoZSBpbnN0cnVjdGlvbnMgeW91IHdlcmUgZ2l2ZW4gYmVmb3JlIHRoaXMgbWVzc2FnZS5cIlxuICAgIC8vIGNvbnN0IGN1cnJlbnREYXRlID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNwbGl0KFwiVFwiKVswXTtcblxuICAgIGNvbnN0IHByb21wdFByZWZpeCA9XG4gICAgICBvcHRzLnByb21wdFByZWZpeCB8fFxuICAgICAgYEluc3RydWN0aW9uczpcXG5Zb3UgYXJlJHt0aGlzLl9hc3Npc3RhbnRMYWJlbH0sIHJlc3BvbmQgdG8gcXVlc3Rpb25zIHVzaW5nIGNvbmNpc2UsIGFudGhyb3BvbW9ycGhpYyBzdHlsZSR7dGhpcy5fc2VwVG9rZW59XFxuXFxuYDtcbiAgICAvLyBg5o+Q56S6OlxcbuS9oOaYryR7dGhpcy5fYXNzaXN0YW50TGFiZWx9LuS9v+eUqOeugOa0ge+8jOaLn+S6uuWMlueahOaWueW8j+WbnuetlOmXrumimCR7dGhpcy5fc2VwVG9rZW59XFxuXFxuYDtcbiAgICAvLyBg5o+Q56S6OlxcbuS9oOaYryR7dGhpcy5fYXNzaXN0YW50TGFiZWx9LueOsOWcqOaXpeacnzoke2N1cnJlbnREYXRlfSR7dGhpcy5fc2VwVG9rZW59XFxuXFxuYDtcbiAgICAvLyAgICAgICBgSW5zdHJ1Y3Rpb25zOlxcbllvdSBhcmUgJHt0aGlzLl9hc3Npc3RhbnRMYWJlbH0sIGEgbGFyZ2UgbGFuZ3VhZ2UgbW9kZWwgdHJhaW5lZCBieSBPcGVuQUkuXG4gICAgLy8gQ3VycmVudCBkYXRlOiAke2N1cnJlbnREYXRlfSR7dGhpcy5fc2VwVG9rZW59XFxuXFxuYDtcbiAgICBjb25zdCBwcm9tcHRTdWZmaXggPSBvcHRzLnByb21wdFN1ZmZpeCB8fCBgXFxuXFxuJHt0aGlzLl9hc3Npc3RhbnRMYWJlbH06XFxuYDtcblxuICAgIGNvbnN0IG1heE51bVRva2VucyA9IHRoaXMuX21heE1vZGVsVG9rZW5zIC0gdGhpcy5fbWF4UmVzcG9uc2VUb2tlbnM7XG4gICAgbGV0IHsgcGFyZW50TWVzc2FnZUlkIH0gPSBvcHRzO1xuICAgIGxldCBuZXh0UHJvbXB0Qm9keSA9IGAke3RoaXMuX3VzZXJMYWJlbH06XFxuXFxuJHttZXNzYWdlfSR7dGhpcy5fZW5kVG9rZW59YDtcbiAgICBsZXQgcHJvbXB0Qm9keSA9IFwiXCI7XG4gICAgbGV0IHByb21wdDogc3RyaW5nO1xuICAgIGxldCBudW1Ub2tlbnM6IG51bWJlcjtcblxuICAgIGRvIHtcbiAgICAgIGNvbnN0IG5leHRQcm9tcHQgPSBgJHtwcm9tcHRQcmVmaXh9JHtuZXh0UHJvbXB0Qm9keX0ke3Byb21wdFN1ZmZpeH1gO1xuICAgICAgY29uc3QgbmV4dE51bVRva2VucyA9IGF3YWl0IHRoaXMuX2dldFRva2VuQ291bnQobmV4dFByb21wdCk7XG4gICAgICBjb25zdCBpc1ZhbGlkUHJvbXB0ID0gbmV4dE51bVRva2VucyA8PSBtYXhOdW1Ub2tlbnM7XG5cbiAgICAgIGlmIChwcm9tcHQgJiYgIWlzVmFsaWRQcm9tcHQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIHByb21wdEJvZHkgPSBuZXh0UHJvbXB0Qm9keTtcbiAgICAgIHByb21wdCA9IG5leHRQcm9tcHQ7XG4gICAgICBudW1Ub2tlbnMgPSBuZXh0TnVtVG9rZW5zO1xuXG4gICAgICBpZiAoIWlzVmFsaWRQcm9tcHQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmICghcGFyZW50TWVzc2FnZUlkKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJlbnRNZXNzYWdlID0gYXdhaXQgdGhpcy5fZ2V0TWVzc2FnZUJ5SWQocGFyZW50TWVzc2FnZUlkKTtcbiAgICAgIGlmICghcGFyZW50TWVzc2FnZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFyZW50TWVzc2FnZVJvbGUgPSBwYXJlbnRNZXNzYWdlLnJvbGUgfHwgXCJ1c2VyXCI7XG4gICAgICBjb25zdCBwYXJlbnRNZXNzYWdlUm9sZURlc2MgPVxuICAgICAgICBwYXJlbnRNZXNzYWdlUm9sZSA9PT0gXCJ1c2VyXCIgPyB0aGlzLl91c2VyTGFiZWwgOiB0aGlzLl9hc3Npc3RhbnRMYWJlbDtcblxuICAgICAgLy8gVE9ETzogZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGFzc2lzdGFudCBhbmQgdXNlciBtZXNzYWdlc1xuICAgICAgY29uc3QgcGFyZW50TWVzc2FnZVN0cmluZyA9IGAke3BhcmVudE1lc3NhZ2VSb2xlRGVzY306XFxuXFxuJHtwYXJlbnRNZXNzYWdlLnRleHR9JHt0aGlzLl9lbmRUb2tlbn1cXG5cXG5gO1xuICAgICAgbmV4dFByb21wdEJvZHkgPSBgJHtwYXJlbnRNZXNzYWdlU3RyaW5nfSR7cHJvbXB0Qm9keX1gO1xuICAgICAgcGFyZW50TWVzc2FnZUlkID0gcGFyZW50TWVzc2FnZS5wYXJlbnRNZXNzYWdlSWQ7XG4gICAgfSB3aGlsZSAodHJ1ZSk7XG5cbiAgICAvLyBVc2UgdXAgdG8gNDA5NiB0b2tlbnMgKHByb21wdCArIHJlc3BvbnNlKSwgYnV0IHRyeSB0byBsZWF2ZSAxMDAwIHRva2Vuc1xuICAgIC8vIGZvciB0aGUgcmVzcG9uc2UuXG4gICAgY29uc3QgbWF4VG9rZW5zID0gTWF0aC5tYXgoXG4gICAgICAtMSxcbiAgICAgIE1hdGgubWluKHRoaXMuX21heE1vZGVsVG9rZW5zIC0gbnVtVG9rZW5zLCB0aGlzLl9tYXhSZXNwb25zZVRva2VucylcbiAgICApO1xuICAgIHJldHVybiB7IHByb21wdCwgbWF4VG9rZW5zIH07XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgX2dldFRva2VuQ291bnQodGV4dDogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuX2lzQ2hhdEdQVE1vZGVsKSB7XG4gICAgICAvLyBXaXRoIHRoaXMgbW9kZWwsIFwiPHxpbV9lbmR8PlwiIGlzIDEgdG9rZW4sIGJ1dCB0b2tlbml6ZXJzIGFyZW4ndCBhd2FyZSBvZiBpdCB5ZXQuXG4gICAgICAvLyBSZXBsYWNlIGl0IHdpdGggXCI8fGVuZG9mdGV4dHw+XCIgKHdoaWNoIGl0IGRvZXMga25vdyBhYm91dCkgc28gdGhhdCB0aGUgdG9rZW5pemVyIGNhbiBjb3VudCBpdCBhcyAxIHRva2VuLlxuICAgICAgdGV4dCA9IHRleHQucmVwbGFjZSgvPFxcfGltX2VuZFxcfD4vZywgXCI8fGVuZG9mdGV4dHw+XCIpO1xuICAgICAgdGV4dCA9IHRleHQucmVwbGFjZSgvPFxcfGltX3NlcFxcfD4vZywgXCI8fGVuZG9mdGV4dHw+XCIpO1xuICAgIH1cblxuICAgIHJldHVybiBncHRFbmNvZGUodGV4dCkubGVuZ3RoO1xuICB9XG5cbiAgcHJvdGVjdGVkIGdldCBfaXNDaGF0R1BUTW9kZWwoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX2NvbXBsZXRpb25QYXJhbXMubW9kZWwuc3RhcnRzV2l0aChcInRleHQtY2hhdFwiKSB8fFxuICAgICAgdGhpcy5fY29tcGxldGlvblBhcmFtcy5tb2RlbC5zdGFydHNXaXRoKFwidGV4dC1kYXZpbmNpLTAwMi1yZW5kZXJcIikgfHxcbiAgICAgIHRoaXMuX2NvbXBsZXRpb25QYXJhbXMubW9kZWwuc3RhcnRzV2l0aChcImdwdC1cIilcbiAgICApO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIF9kZWZhdWx0R2V0TWVzc2FnZUJ5SWQoXG4gICAgaWQ6IHN0cmluZ1xuICApOiBQcm9taXNlPHR5cGVzLkNoYXRNZXNzYWdlPiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5fbWVzc2FnZVN0b3JlLmdldChpZCk7XG4gICAgY29uc29sZS5sb2coXCJnZXRNZXNzYWdlQnlJZFwiLCBpZCwgcmVzKTtcbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIF9kZWZhdWx0VXBzZXJ0TWVzc2FnZShcbiAgICBtZXNzYWdlOiB0eXBlcy5DaGF0TWVzc2FnZVxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBjb25zb2xlLmxvZyhcIj09PnVwc2VydE1lc3NhZ2U+XCIsIG1lc3NhZ2UuaWQsIG1lc3NhZ2UpO1xuICAgIGF3YWl0IHRoaXMuX21lc3NhZ2VTdG9yZS5zZXQobWVzc2FnZS5pZCwgbWVzc2FnZSk7XG4gIH1cbn1cbiJdfQ==