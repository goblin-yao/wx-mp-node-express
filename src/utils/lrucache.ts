import Keyv from 'keyv';
import QuickLRU from 'quick-lru';
import * as types from '../chatgptlib/types';

//十万条数据的缓存
export const messagesLRUCache = new Keyv<types.ChatMessage, any>({
  store: new QuickLRU<string, types.ChatMessage>({ maxSize: 100000 }),
});

//十万条数据的缓存
export const exampleLoginLRUCache = new Keyv<types.ChatMessage, any>({
  store: new QuickLRU<string, string>({ maxSize: 100000 }),
});
