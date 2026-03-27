CREATE POLICY "Users can view own brokerage_connections"
  ON public.brokerage_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own brokerage_connections"
  ON public.brokerage_connections FOR ALL
  USING (auth.uid() = user_id);
