export interface Follow {
  id: string;
  follower_id: string;
  leader_id: string;
  copy_ratio: number;       // 0.0 - 1.0
  max_position_size: number; // dollar amount
  is_active: boolean;
}

export interface CopiedTrade {
  id: string;
  user_id: string;
  signal_id: string;
  brokerage_connection_id: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executed_at: string;
  status: 'pending' | 'executed' | 'failed';
  error_message?: string;
}

export interface CopyExecutionResult {
  success: boolean;
  copied_trade_id?: string;
  error?: string;
}
