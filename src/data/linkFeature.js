import axios from "@/assets/js/axios";

/**
 * 查询指定要素的关联要素的数据
 * @param {*} layerid
 * @param {string} featureId
 * @param {query[]} querys
 */
async function getRelations(layerid, querys) {
  let dataList = [];
  //dataPages/xyyz/Handler.ashx?action=getRelations&id=14874&_=1584591771154
    const result = await axios.post(`/dataPages/${layerid}/Handler.ashx?action=getRelations`, { querys: querys });
    dataList = result.data.list;
    

  return dataList.map(m => {
    // updateFeatureProperties(m, layerid);
    return rectify(m, layerid);
  });
}

/**
 * 添加要素
 * 若添加成功，则将要素的id更新
 * @param {*} layerid
 * @param {*} feature
 */
async function add(layerid, feature) {
  const id = feature.id;
  const model = modelToEntityKeyValue(feature.properties);
  /**特例 sq */
  let result;
  if (layerid === 'sq' || layerid === 'roadnetwork' || layerid === 'corridor') { 
    result = await axios.post(`/dataPages/${layerid}/Handler.ashx`, qs.stringify({action:'update', id, model}), { headers: { "Content-Type": "application/x-www-form-urlencoded" }});
  } else { /**通例 */
    result = await axios.post(`/dataPages/${layerid}/Handler.ashx?action=update`, { model });
  }
  feature.id = result.data.newId;
  feature.properties.ID = result.data.newId;
  updateFeatureProperties(feature.properties, layerid);

  if (layerid === 'xzqh' || layerid === 'roadnetwork') return result.data;
  return feature.id || result.data.update;
}

/**
 * 添加要素为了动作是add的
 * @param {number} layerid  图层id
 * @param {Object} model
 */
async function addForActionAdd(layerid, model) {
  const url = `/dataPages/${layerid}/Handler.ashx`;
  const { data } = await axios.post(
    url,
    qs.stringify({
      action: "add",
      ...model
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  model.id = data;
  model.ID = data;
  updateFeatureProperties(model, layerid);
  return data;
}
/**
 * 更新要素
 * @param {*} layerid
 * @param {*} feature
 */
export async function update(layerid, feature) {
  console.log(feature)
  const model = modelToEntityKeyValue(feature.properties);
  const { data } = await axios.post(`/dataPages/${layerid}/Handler.ashx?action=update`, {
    model,
    id: feature.id
  });

  return data;
}

/**
 * 移除一组要素
 * @param {*} layerid
 * @param {Array<feature>} features
 */
export async function remove(layerid, features) {
  console.log(features)
  await axios.get(`/dataPages/${layerid}/Handler.ashx?action=del`, {
    params: { ids: `[${features.map(f => f.id).join(",")}]` }
  });
}

/**
 * 为要素附加扩展属性和变换日期类型
 * @param {*} properties
 * @param {*} layerid
 */
function updateFeatureProperties(properties, layerid, id) {
  let addpropertys = propertys[layerid];

  let dfs = dateFields[layerid];

  if (id) {
    addpropertys = propertys[layerid][layerid + "-" + id];
  }
  // 附加属性
  addpropertys && Object.defineProperties(properties, addpropertys);
  // console.log("properties------",properties);

  // 日期类型转换
  for (let p in dfs) {
    const date = FromMSJsonString(properties[p]);
    if (date) {
      if (dfs[p] == "date") {
        properties[p] = DateFormat(date, "yyyy-MM-dd");
      } else if (dfs[p] == "time") {
        properties[p] = DateFormat(date, "hh:mm:ss");
      }
    }
  }
}

/**
 * 将要素转换成GEOJSON格式
 */
function rectify(m, layerid, id) {
  updateFeatureProperties(m, layerid, id);

  let type = null;
  let pointList = null;

  type = m.geometryType;
  if (type === "Point") {
    pointList = gcoord.transform(m.coorList, // 经纬度坐标
      gcoord.BD09, // 当前坐标系
      gcoord.EPSG3857 // 目标坐标系
    );
  }

  if (type === "LineString" || type === "Rectangle") {
    pointList =
      m.coorList &&
      m.coorList.map(item => {
        return gcoord.transform(item, // 经纬度坐标
          gcoord.BD09, // 当前坐标系
          gcoord.EPSG3857 // 目标坐标系
        );
      });
  }

  if (type === "Circle") {
    pointList =
      m.coorList &&
      m.coorList.map(item => {
        if (item.length === 2) {
          return gcoord.transform(item, // 经纬度坐标
            gcoord.BD09, // 当前坐标系
            gcoord.EPSG3857 // 目标坐标系
          );
        }
        return item;
      });
  }

  if (type === "Polygon") {
    pointList =
      m.coorList &&
      m.coorList.map(item => {
        return item.map(t => {
          return gcoord.transform(t, // 经纬度坐标
            gcoord.BD09, // 当前坐标系
            gcoord.EPSG3857 // 目标坐标系
          );
        });
      });
  }
  
  return {
    id: m.ID || m.ma.ID,
    geometry: {
      type,
      coordinates: pointList
    },
    properties: m.ma || m
  };
}

export function modelToEntityKeyValue(m) {
  var ms = [];
  for (var p in m) {
    var v = m[p];
    if (v !== null) {
      var type = typeof v;
      //忽略函数类型
      if (type === "function") {
        continue;
      }
      //对于object类型，转为JSON字符串(日期类型除外)
      if (type === "object" && !(v instanceof Date)) {
        v = JSON.stringify(v);
      }
    }
    ms.push([p, v]);
  }
  return JSON.stringify(ms);
}

/**
 * 向图层添加子项
 * @param {number} layerid 要添加子项的图层id
 * @param {*} model             创建子项需要的数据
 */
async function addItemOfLayer(layerid, model) {
  let url = `/dataPages/${layerid}/Handler.ashx`;
  const { data } = await axios.post(
    url,
    qs.stringify({
      action: "update",
      model: JSON.stringify(model)
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return data;
}

/**
 * 向图层修改子项
 * @param {number} layerid 要修改子项的图层id
 * @param {number} subId    要修改子项 subId
 * @param {*} model             创建子项需要的数据
 */
async function updateItemOfLayer(layerid, subId, model) {
  let url = `/dataPages/${layerid}/Handler.ashx`;
  const { data } = await axios.post(
    url,
    qs.stringify({
      action: "update",
      id: subId,
      model: JSON.stringify(model)
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return data;
}
/**
 * 获取子项信息 by id
 * @param {number} layerid 图层id
 * @param {number} id 子项id
 */
async function getList(layerid, id) {
  const url = `/dataPages/${layerid}/Handler.ashx`;
  const { data } = await axios.get(url, {
    params: {
      action: "GetList",
      querys: JSON.stringify([{ field: "ID", value: id, relation: "=", type: "int" }]),
      _: new Date().getTime()
    }
  });

  return data;
}
/**
 * 更新ma经济数据信息 with 年份 by 年度id and 年度model
 * @param {number} featureId 年度id
 * @param  {Object} model 年度model
 * @return {{update: true}} data
 */
export async function updateItemForJj(yearId, model) {
  const url = `/dataPages/ma/MajjHandler.ashx`;
  const { data } = await axios.post(
    url,
    qs.stringify({
      action: "update",
      ID: yearId,
      model: modelToEntityKeyValue(model)
    })
  );
  return data;
}

/**
 * 更新maRanking信息 with 年份 by 年度id and model
 * @param {number} featureId 年度id
 * @param  {Object} model 年度model
 * @return {{update: true}} data
 */
export async function updateItemForRk(yearId, model) {
  const url = `/dataPages/ma/MaRankingHandler.ashx`;
  const { data } = await axios.post(
    url,
    qs.stringify({
      action: "update",
      ID: yearId,
      model: modelToEntityKeyValue(model)
    })
  );
  return data;
}

export default {
  get,
  add,
  update,
  remove,
  rectify,
  FromMSJsonString,
  addItemOfLayer,
  getList,
  addForActionAdd,
  updateItemForRk,
  updateItemForJj,
  updateItemOfLayer
};
