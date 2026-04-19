/**
 * API 测试客户端
 * 封装 HTTP 请求方法，自动处理 baseURL 和响应解析
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const json = await response.json();
  return json as ApiResponse<T>;
}

/**
 * GET 请求
 */
export async function apiGet<T = unknown>(path: string): Promise<ApiResponse<T>> {
  return request<T>('GET', path);
}

/**
 * POST 请求
 */
export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>('POST', path, body);
}

/**
 * PATCH 请求
 */
export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>('PATCH', path, body);
}

/**
 * PUT 请求
 */
export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>('PUT', path, body);
}

/**
 * DELETE 请求
 */
export async function apiDelete<T = unknown>(path: string): Promise<ApiResponse<T>> {
  return request<T>('DELETE', path);
}

/**
 * 上传文件（multipart/form-data）
 */
export async function apiUpload<T = unknown>(
  path: string,
  fileContent: string,
  fileName: string,
  extraFields?: Record<string, string>
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const formData = new FormData();
  const blob = new Blob([fileContent], { type: 'text/csv' });
  formData.append('file', blob, fileName);

  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      formData.append(key, value);
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const json = await response.json();
  return json as ApiResponse<T>;
}
