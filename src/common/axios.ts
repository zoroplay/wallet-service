/* eslint-disable prettier/prettier */
import axios from 'axios';

export const post = async (url, payload, headers) => {
  try {
    const res = await axios.post(url, payload, { headers });
    return res.data;
  } catch (e) {
    console.log(e.message);
  }
};

export const get = async (url, headers) => {
  try {
    const res = await axios.get(url, { headers });
    return res.data;
  } catch (e) {
    console.log(e.message);
  }
};
