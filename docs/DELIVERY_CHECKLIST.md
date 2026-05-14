# Delivery Checklist

用于发布前功能验收与演示对照。

## 1. Feature checklist

- [x] Host 可加入 room 并启动屏幕采集
- [x] Viewer 可加入相同 room 并看到 Host 画面
- [x] 画面通过 WebRTC MediaStream 传输
- [x] 服务端只做信令（join / peer-joined / offer / answer / ice-candidate / peer-left / error）
- [x] RTCDataChannel 用于控制事件传输
- [x] Viewer 监听 mousemove/mousedown/mouseup/click/keydown/keyup
- [x] 控制事件坐标归一化为 0~1
- [x] Host 接收控制事件并记录日志
- [x] Host `Allow Remote Control` 关闭时只记录不执行
- [x] Host `Allow Remote Control` 开启时走真实执行链路（nut.js）
- [x] nut.js 不可用时自动 fallback 到 mock，不崩溃
- [x] Viewer 默认不发送控制事件（需手动 Enable）
- [x] Viewer 支持 ESC 紧急停止发送

## 2. Local single-machine test checklist

- [ ] 启动 `pnpm dev:server`
- [ ] 启动 `pnpm dev:client`
- [ ] 第一个窗口进入 Host，第二个窗口进入 Viewer
- [ ] 两端 roomId 一致
- [ ] Host 点击 `Start Screen Share`
- [ ] Viewer 成功显示远程画面
- [ ] Viewer 点击 `Enable Remote Control` 后，Host 日志开始出现控制事件
- [ ] Viewer 按 ESC 后，停止发送控制事件
- [ ] Host 未开启 `Allow Remote Control` 时不会执行真实输入

## 3. Two-machine test checklist

- [ ] Machine A 运行 Host
- [ ] Machine B 运行 Viewer
- [ ] 两台机器连接同一信令服务地址
- [ ] 相同 roomId 入房并成功连通
- [ ] Viewer 可稳定看到 Host 画面
- [ ] Viewer 启用控制发送，Host 启用允许控制
- [ ] Host 机器上出现真实鼠标/键盘动作
- [ ] 关闭任一端后另一端收到 `peer-left`

## 4. Known limitations

- 单机双开真实控制会产生“自控冲突”，属于远控系统正常现象
- 分享包含 Viewer 的同一屏幕会出现镜中镜递归
- 当前优先本地网络/简单 NAT，复杂网络需要 TURN
- 暂无用户鉴权、审计日志和权限系统

## 5. Stakeholder Demo Notes

- 核心链路完整：信令、建连、媒体传输、控制事件、权限控制。
- 媒体流与信令解耦：媒体点对点，服务端仅做信令，扩展成本更可控。
- 安全默认值：Viewer 默认禁发控制，Host 默认禁执行真实输入，支持紧急停止。
- 可运维性：具备健康检查端点、结构化日志、心跳与空闲连接回收。
- 生产化路线清晰：TURN、鉴权、审计、重连、QoS 与策略治理。

## 6. Screenshots / demo video placeholders

- [ ] `docs/assets/host-panel.png`（Host 状态与控制日志）
- [ ] `docs/assets/viewer-panel.png`（Viewer 画面与控制开关）
- [ ] `docs/assets/permissions-macos.png`（macOS 权限页）
- [ ] `docs/assets/single-machine-demo.mp4`（单机链路演示）
- [ ] `docs/assets/two-machine-demo.mp4`（双机真实控制演示）
