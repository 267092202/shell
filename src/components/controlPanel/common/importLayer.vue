<template>
  <el-dialog
    title="导入数据表"
    :before-close="handleClose"
    :visible="dialogVisible"
    width="750px"
    center
    custom-class="dialog"
    :close-on-click-modal="false"
    :append-to-body="true"
  >
    <div class="import_content">
      <el-upload
        class="upload-demo"
        ref="upload"
        drag
        action="void javascrpt:(0)"
        :auto-upload="false"
        :limit="1"
        :on-exceed="onUploadExceed"
        :on-change="onFileChange"
        :on-remove="() => ishasFile = false"
      >
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">
          将文件拖到此处，或
          <em>点击上传</em>
        </div>
        <div class="el-upload__tip" slot="tip" style="color: #909399;">导入数据时出现不是预期格式时, 请另存为office2007版本或用wps保存</div>
      </el-upload>
    </div>
    <span slot="footer" class="dialog-footer">
      <el-button size="mini" icon="el-icon-remove-outline" @click="handleClose(false)">取 消</el-button>
      <el-button
        size="mini"
        v-if="ishasFile"
        icon="el-icon-upload2"
        :loading="uploading"
        type="primary"
        @click="uploadExcel()"
      >上 传</el-button>
    </span>
  </el-dialog>
</template>

<script>
import XLSX from "xlsx";
import { mapState } from "vuex";
import { importExcelBatch } from "@/data/layerExcelIO";

export default {
  props: ["dialogVisible"],
  computed: {
    ...mapState({ currentLayer: state => state.layer.currentLayer })
  },
  data() {
    return {
      ishasFile: false,
      uploading: false
    };
  },
  methods: {
    handleClose(done) {
      if (this.ishasFile && !this.uploading) {
        this.$confirm("文件暂未上传, 是否退出?", "提示", {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning"
        })
          .then(() => {
            this.$refs.upload.clearFiles();
            this.ishasFile = false;
            this.$emit("update:dialogVisible", false);
          })
          .catch(() => {});
        return;
      } else if (this.isUploading) {
        // 取消上传
        this.$refs.upload.abort();
        this.uploading = false;
        this.$refs.upload.clearFiles();
        this.ishasFile = false;
        this.$message.warning({ message: "已取消上传", offset: 60 });
      }
      this.$emit("update:dialogVisible", false);
    },
    // updateVisible(b) {
    //   this.$emit("update:dialogVisible", b);
    // },
    onUploadExceed() {
      this.$message.error({ message: "一次只能上传一个文件!", offset: 60 });
    },
    onFileChange(file) {
      this.ishasFile = true;
      switch (file.status) {
        case "ready":
          // 选择文件成功时,检查文件格式
          // console.log("file", file);
          const exct = file.name.slice(-3);
          // console.log(!/\.[csv|xlsx|xls]/.test(file.name));
          if (!/\.[csv|xlsx|xls]/.test(file.name)) {
            this.ishasFile = false;
            this.$refs.upload.clearFiles();
            this.$message.error({
              message: "请上传csv文件或Excel文件",
              offset: 60
            });
            break;
          }
      }
    },
    uploadExcel() {
      // 执行时ishasFile已为true
      const { uploadFiles } = this.$refs.upload;
      const file = uploadFiles[0];
      const formData = new FormData();
      formData.append("table", file.raw);
      this.uploading = true;
      importExcelBatch(this.currentLayer.id, formData)
        .then(res => {
          this.uploading = false;
          this.$refs.upload.clearFiles();
          this.ishasFile = false;
          let msg = `文件上传成功! 更新${res.update}条, 错误${res.errorcont}条`;
          msg += (res.errorString == '') ? '' : `<div style="color: #F56C6C; max-height: 100px; width: 300px; overflow: scroll;">错误信息: <br/>${res.errorString.replace(/\n/g, '。<br/>')}</div>` 
          this.$message.success({dangerouslyUseHTMLString: true, message: msg, offset: 60, showClose: true, duration: 0});
        })
        .catch(err => {
          this.uploading = false;
          this.$message.error({ message: "文件上传失败,请重试", offset: 60 });
        });
    }
  }
};
</script>

<style lang='scss' scoped>
.import_content {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}
</style>