import { OPENAI_API_KEY, CONSTANTS } from '@config';

/**
 * 获取一个随机PROXYURL
 * @returns
 */
export function getRandomElementFromArray<T>(keyArray: Array<T>): T {
  return keyArray[Math.floor(Math.random() * keyArray.length)];
}
/**
 * 获取一个随机key
 * @returns
 */
export const getAPIKEY = () => {
  const keyArray = OPENAI_API_KEY.replace(/\s/g, '').split(';');
  return getRandomElementFromArray(keyArray);
};

/**
 * 获取一个随机PROXYURL
 * @returns
 */
export const getPROXYURL = () => {
  return getRandomElementFromArray(CONSTANTS.OPENAI_PROXY_URL);
};

/**
 * @method isEmpty
 * @param {String | Number | Object} value
 * @returns {Boolean} true & false
 * @description this value is Empty Check
 */
export const isEmpty = (value: string | number | object): boolean => {
  if (value === null) {
    return true;
  } else if (typeof value !== 'number' && value === '') {
    return true;
  } else if (typeof value === 'undefined' || value === undefined) {
    return true;
  } else if (value !== null && typeof value === 'object' && !Object.keys(value).length) {
    return true;
  } else {
    return false;
  }
};

/**
 * 获取当前时间3个月后的时间
 */
export const getTimeStampOfMonthLater = (monthNums: number) => {
  let currentDate = new Date(); // 获取当前时间
  currentDate.setMonth(currentDate.getMonth() + monthNums); // 设置当前时间的月份+monthNums
  return currentDate.getTime() - new Date().getTime();
};
