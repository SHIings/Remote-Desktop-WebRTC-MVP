# DELIVERY CHECKLIST

用于面试交付前的自检与演示对照。

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

## 5. What to tell the interviewer

- 这是一个按 MVP 取舍完成的一天作业：核心链路可跑通、结构分层清晰、演示路径完整。
- 媒体流走 WebRTC，控制事件走 DataChannel，服务端仅做信令转发，符合远控架构边界。
- 已实现安全保护：Viewer 默认禁发、Host 默认禁执行、ESC 紧急停止、权限检测与引导。
- 真实输入能力采用 nut.js，并做了失败降级，避免安装/权限问题导致程序崩溃。
- 生产化下一步重点：TURN、鉴权、重连、审计、显示器选择与输入节流。

## 6. Screenshots / demo video placeholders

- [ ] `docs/assets/host-panel.png`（Host 状态与控制日志）
- [ ] `docs/assets/viewer-panel.png`（Viewer 画面与控制开关）
- [ ] `docs/assets/permissions-macos.png`（macOS 权限页）
- [ ] `docs/assets/single-machine-demo.mp4`（单机链路演示）
- [ ] `docs/assets/two-machine-demo.mp4`（双机真实控制演示）
