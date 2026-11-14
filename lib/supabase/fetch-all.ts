const PAGE = 1000; // PostgREST trả tối đa 1000 dòng/lần

/** Đọc hết các trang của 1 query Supabase (dữ liệu nhiều tháng có thể > 1000 dòng). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += PAGE) {
    const { data, error } = await page(i, i + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}
