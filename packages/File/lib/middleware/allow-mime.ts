import fs from 'fs-extra';
import { TRPGMiddleware } from 'trpg/core';
import _ from 'lodash';

/**
 * 限定文件MIME类型的中间件, 应放在upload中间件后
 */
export default function allowMIME(types: MIMEType[]): TRPGMiddleware {
  return async (ctx, next) => {
    const file = _.get(ctx, 'req.file');
    if (_.isNil(file)) {
      throw new Error('文件不存在');
    }

    const { mimetype, path } = file;
    if (!types.includes(mimetype)) {
      await fs.remove(path);

      throw new Error('不允许的文件类型:' + mimetype);
    }

    return next();
  };
}

type MIMEType =
  | 'application/envoy'
  | 'application/fractals'
  | 'application/futuresplash'
  | 'application/hta'
  | 'application/internet-property-stream'
  | 'application/mac-binhex40'
  | 'application/msword'
  | 'application/msword'
  | 'application/octet-stream'
  | 'application/oda'
  | 'application/olescript'
  | 'application/pdf'
  | 'application/pics-rules'
  | 'application/pkcs10'
  | 'application/pkix-crl'
  | 'application/postscript'
  | 'application/rtf'
  | 'application/set-payment-initiation'
  | 'application/set-registration-initiation'
  | 'application/vnd.ms-excel'
  | 'application/vnd.ms-outlook'
  | 'application/vnd.ms-pkicertstore'
  | 'application/vnd.ms-pkiseccat'
  | 'application/vnd.ms-pkistl'
  | 'application/vnd.ms-powerpoint'
  | 'application/vnd.ms-project'
  | 'application/vnd.ms-works'
  | 'application/winhlp'
  | 'application/x-bcpio'
  | 'application/x-cdf'
  | 'application/x-compress'
  | 'application/x-compressed'
  | 'application/x-cpio'
  | 'application/x-csh'
  | 'application/x-director'
  | 'application/x-dvi'
  | 'application/x-gtar'
  | 'application/x-gzip'
  | 'application/x-hdf'
  | 'application/x-internet-signup'
  | 'application/x-iphone'
  | 'application/x-javascript'
  | 'application/x-latex'
  | 'application/x-msaccess'
  | 'application/x-mscardfile'
  | 'application/x-msclip'
  | 'application/x-msdownload'
  | 'application/x-msmediaview'
  | 'application/x-msmetafile'
  | 'application/x-msmoney'
  | 'application/x-mspublisher'
  | 'application/x-msschedule'
  | 'application/x-msterminal'
  | 'application/x-mswrite'
  | 'application/x-netcdf'
  | 'application/x-perfmon'
  | 'application/x-pkcs12'
  | 'application/x-pkcs7-certificates'
  | 'application/x-pkcs7-certreqresp'
  | 'application/x-pkcs7-mime'
  | 'application/x-pkcs7-signature'
  | 'application/x-sh'
  | 'application/x-shar'
  | 'application/x-shockwave-flash'
  | 'application/x-stuffit'
  | 'application/x-sv4cpio'
  | 'application/x-sv4crc'
  | 'application/x-tar'
  | 'application/x-tcl'
  | 'application/x-tex'
  | 'application/x-texinfo'
  | 'application/x-troff'
  | 'application/x-troff-man'
  | 'application/x-troff-me'
  | 'application/x-troff-ms'
  | 'application/x-ustar'
  | 'application/x-wais-source'
  | 'application/x-x509-ca-cert'
  | 'application/ynd.ms-pkipko'
  | 'application/zip'
  | 'audio/basic'
  | 'audio/mid'
  | 'audio/mpeg'
  | 'audio/x-aiff'
  | 'audio/x-mpegurl'
  | 'audio/x-pn-realaudio'
  | 'audio/x-wav'
  | 'image/bmp'
  | 'image/cis-cod'
  | 'image/gif'
  | 'image/ief'
  | 'image/jpeg'
  | 'image/png'
  | 'image/pipeg'
  | 'image/svg+xml'
  | 'image/tiff'
  | 'image/x-cmu-raster'
  | 'image/x-cmx'
  | 'image/x-icon'
  | 'image/x-portable-anymap'
  | 'image/x-portable-bitmap'
  | 'image/x-portable-graymap'
  | 'image/x-portable-pixmap'
  | 'image/x-rgb'
  | 'image/x-xbitmap'
  | 'image/x-xpixmap'
  | 'image/x-xwindowdump'
  | 'message/rfc822'
  | 'text/css'
  | 'text/h323'
  | 'text/html'
  | 'text/iuls'
  | 'text/plain'
  | 'text/richtext'
  | 'text/scriptlet'
  | 'text/tab-separated-values'
  | 'text/webviewhtml'
  | 'text/x-component'
  | 'text/x-setext'
  | 'text/x-vcard'
  | 'video/mpeg'
  | 'video/quicktime'
  | 'video/x-la-asf'
  | 'video/x-ms-asf'
  | 'video/x-msvideo'
  | 'video/x-sgi-movie'
  | 'x-world/x-vrml';
