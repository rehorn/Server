---
id: row
title: <Row />
---

```xml
<Row>
  ....
</Row>
```

独立占用一行。一般可以与`Col`标签来描述人物卡的布局

## API

| 名称 | 类型 | 描述 | 默认值 |
| ---- | ---- | ---- | ---- | 
| gutter | number/object/array | 栅格间隔，可以写成像素值或支持响应式的对象写法来设置水平间隔 { xs: 8, sm: 16, md: 24}。或者使用数组形式同时设置 [水平间距, 垂直间距] | 0 |
| align | "top"\|"middle"\|"bottom"\|"stretch" | 垂直对齐方式 | |
| justify | "start"\|"end"\|"center"\|"space-around"\|"space-between" | 水平排列方式	 | |
